module.exports = AMQPParser;

function AMQPParser (version, type) {
  this.isClient = (type == 'client');
  this.state = this.isClient ? 'frameHeader' : 'protocolHeader';

  if (version != '0-9-1') this.throwError("Unsupported protocol version");

  var frameHeader = new Buffer(7);
  frameHeader.used = 0;
  var frameBuffer, frameType, frameChannel;

  var self = this;

  function header(data) {
    var fh = frameHeader;
    var needed = fh.length - fh.used;
    data.copy(fh, fh.used, 0, data.length);
    fh.used += data.length; // sloppy
    if (fh.used >= fh.length) {
      fh.read = 0;
      frameType = fh[fh.read++];
      frameChannel = parseInteger(fh, 2, self);
      var frameSize = parseInteger(fh, 4, self);
      fh.used = 0; // for reuse
      if (frameSize > maxFrameBuffer) {
        self.throwError("Oversized frame " + frameSize);
      }
      frameBuffer = new Buffer(frameSize);
      frameBuffer.used = 0;
      return frame(data.slice(needed));
    }
    else { // need more!
      return header;
    }
  }

  function frame(data) {
    var fb = frameBuffer;
    var needed = fb.length - fb.used;
    var sourceEnd = (fb.length > data.length) ? data.length : fb.length;
    data.copy(fb, fb.used, 0, sourceEnd);
    fb.used += data.length;
    if (data.length > needed) {
      return frameEnd(data.slice(needed));
    }
    else if (data.length == needed) {
      return frameEnd;
    }
    else {
      return frame;
    }
  }

  function frameEnd(data) {
    if (data.length > 0) {
      if (data[0] === Indicators.FRAME_END) {
        switch (frameType) {
        case FrameType.METHOD:
          self._parseMethodFrame(frameChannel, frameBuffer);
          break;
        case FrameType.HEADER:
          self._parseHeaderFrame(frameChannel, frameBuffer);
          break;
        case FrameType.BODY:
          if (self.onContent) {
            self.onContent(frameChannel, frameBuffer);
          }
          break;
        case FrameType.HEARTBEAT:
          debug("heartbeat");
          if (self.onHeartBeat) self.onHeartBeat();
          break;
        default:
          self.throwError("Unhandled frame type " + frameType);
          break;
        }
        return header(data.slice(1));
      }
      else {
        self.throwError("Missing frame end marker");
      }
    }
    else {
      return frameEnd;
    }
  }

  self.parse = header;
}

// If there's an error in the parser, call the onError handler or throw
AMQPParser.prototype.throwError = function (err) {
  if(this.onError) this.onError(err);
  else this.emit("error", err);
};

// Everytime data is recieved on the socket, pass it to this function for
// parsing.
AMQPParser.prototype.execute = function (data) {
  // This function only deals with dismantling and buffering the frames.
  // It delegates to other functions for parsing the frame-body.
  debug('execute: ' + data.toString('hex'));
  this.parse = this.parse(data);
};


// parse Network Byte Order integers. size can be 1,2,4,8
function parseInteger (buffer, size, emitter) {
  switch (size) {
    case 1:
      return buffer[buffer.read++];

    case 2:
      return (buffer[buffer.read++] << 8) + buffer[buffer.read++];

    case 4:
      return (buffer[buffer.read++] << 24) + (buffer[buffer.read++] << 16) +
             (buffer[buffer.read++] << 8)  + buffer[buffer.read++];

    case 8:
      return (buffer[buffer.read++] << 56) + (buffer[buffer.read++] << 48) +
             (buffer[buffer.read++] << 40) + (buffer[buffer.read++] << 32) +
             (buffer[buffer.read++] << 24) + (buffer[buffer.read++] << 16) +
             (buffer[buffer.read++] << 8)  + buffer[buffer.read++];

    default:
      return emitError(emitter, "cannot parse ints of that size");
  }
}


function parseShortString (buffer) {
  var length = buffer[buffer.read++];
  var s = buffer.toString('utf8', buffer.read, buffer.read+length);
  buffer.read += length;
  return s;
}


function parseLongString (buffer, emitter) {
  var length = parseInteger(buffer, 4, emitter);
  var s = buffer.slice(buffer.read, buffer.read + length);
  buffer.read += length;
  return s.toString();
}


function parseSignedInteger (buffer, emitter) {
  var int = parseInteger(buffer, 4, emitter);
  if (int & 0x80000000) {
    int |= 0xEFFFFFFF;
    int = -int;
  }
  return int;
}

function parseValue (buffer, emitter) {
  switch (buffer[buffer.read++]) {
    case AMQPTypes.STRING:
      return parseLongString(buffer, emitter);

    case AMQPTypes.INTEGER:
      return parseInteger(buffer, 4, emitter);

    case AMQPTypes.DECIMAL:
      var dec = parseInteger(buffer, 1, emitter);
      var num = parseInteger(buffer, 4, emitter);
      return num / (dec * 10);

    case AMQPTypes._64BIT_FLOAT:
      var b = [];
      for (var i = 0; i < 8; ++i)
        b[i] = buffer[buffer.read++];

      return (new jspack(true)).Unpack('d', b);

    case AMQPTypes._32BIT_FLOAT:
      var b = [];
      for (var i = 0; i < 4; ++i)
        b[i] = buffer[buffer.read++];

      return (new jspack(true)).Unpack('f', b);

    case AMQPTypes.TIME:
      var int = parseInteger(buffer, 8, emitter);
      return (new Date()).setTime(int * 1000);

    case AMQPTypes.HASH:
      return parseTable(buffer, emitter);

    case AMQPTypes.SIGNED_64BIT:
      return parseInteger(buffer, 8, emitter);

    case AMQPTypes.BOOLEAN:
      return (parseInteger(buffer, 1, emitter) > 0);

    case AMQPTypes.BYTE_ARRAY:
      var len = parseInteger(buffer, 4, emitter);
      var buf = new Buffer(len);
      buffer.copy(buf, 0, buffer.read, buffer.read + len);
      buffer.read += len;
      return buf;

    case AMQPTypes.ARRAY:
      var len = parseInteger(buffer, 4, emitter);
      var end = buffer.read + len;
      var arr = [];

      while (buffer.read < end) {
        arr.push(parseValue(buffer, emitter));
      }

      return arr;

    default:
      return emitError(emitter,"Unknown field value type " + buffer[buffer.read-1]);
  }
}

function parseTable (buffer, emitter) {
  var length = buffer.read + parseInteger(buffer, 4, emitter);
  var table = {};

  while (buffer.read < length) {
    table[parseShortString(buffer)] = parseValue(buffer, emitter);
  }

  return table;
}

function parseFields (buffer, fields, emitter) {
  var args = {};

  var bitIndex = 0;

  var value;

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];

    //debug("parsing field " + field.name + " of type " + field.domain);

    switch (field.domain) {
      case 'bit':
        // 8 bits can be packed into one octet.

        // XXX check if bitIndex greater than 7?

        value = !!(buffer[buffer.read] & (1 << bitIndex));

        if (fields[i+1] && fields[i+1].domain == 'bit') {
          bitIndex++;
        } else {
          bitIndex = 0;
          buffer.read++;
        }
        break;

      case 'octet':
        value = buffer[buffer.read++];
        break;

      case 'short':
        value = parseInteger(buffer, 2, emitter);
        break;

      case 'long':
        value = parseInteger(buffer, 4, emitter);
        break;

      case 'timestamp':
      case 'longlong':
        value = parseInteger(buffer, 8, emitter);
        break;

      case 'shortstr':
        value = parseShortString(buffer);
        break;

      case 'longstr':
        value = parseLongString(buffer, emitter);
        break;

      case 'table':
        value = parseTable(buffer, emitter);
        break;

      default:
        return emitError(emitter,"Unhandled parameter type " + field.domain);
    }
    //debug("got " + value);
    args[field.name] = value;
  }

  return args;
}


AMQPParser.prototype._parseMethodFrame = function (channel, buffer) {
  buffer.read = 0;
  var classId = parseInteger(buffer, 2, this),
     methodId = parseInteger(buffer, 2, this);

  // Make sure that this is a method that we understand.
  if (!methodTable[classId] || !methodTable[classId][methodId]) {
    this.throwError("Received unknown [classId, methodId] pair [" +
               classId + ", " + methodId + "]");
  }

  var method = methodTable[classId][methodId];

  if (!method) this.throwError("bad method?");

  var args = parseFields(buffer, method.fields, this);

  if (this.onMethod) {
    this.onMethod(channel, method, args);
  }
};


AMQPParser.prototype._parseHeaderFrame = function (channel, buffer) {
  buffer.read = 0;

  var classIndex = parseInteger(buffer, 2, this);
  var weight = parseInteger(buffer, 2, this);
  var size = parseInteger(buffer, 8, this);

  var classInfo = classes[classIndex];

  if (classInfo.fields.length > 15) {
    this.throwError("TODO: support more than 15 properties");
  }

  var propertyFlags = parseInteger(buffer, 2, this);

  var fields = [];
  for (var i = 0; i < classInfo.fields.length; i++) {
    var field = classInfo.fields[i];
    // groan.
    if (propertyFlags & (1 << (15-i))) fields.push(field);
  }

  var properties = parseFields(buffer, fields, this);

  if (this.onContentHeader) {
    this.onContentHeader(channel, classInfo, weight, properties, size);
  }
};

function serializeFloat(b, size, value, bigEndian, emitter) {
  var jp = new jspack(bigEndian);

  switch(size) {
  case 4:
    var x = jp.Pack('f', [value]);
    for (var i = 0; i < x.length; ++i)
      b[b.used++] = x[i];
    break;

  case 8:
    var x = jp.Pack('d', [value]);
    for (var i = 0; i < x.length; ++i)
      b[b.used++] = x[i];
    break;

  default:
    return emitError(emitter,"Unknown floating point size");
  }
}

function serializeInt (b, size, int, emitter) {
  if (b.used + size > b.length) {
    return emitError(emitter, "write out of bounds");
  }

  // Only 4 cases - just going to be explicit instead of looping.

  switch (size) {
    // octet
    case 1:
      b[b.used++] = int;
      break;

    // short
    case 2:
      b[b.used++] = (int & 0xFF00) >> 8;
      b[b.used++] = (int & 0x00FF) >> 0;
      break;

    // long
    case 4:
      b[b.used++] = (int & 0xFF000000) >> 24;
      b[b.used++] = (int & 0x00FF0000) >> 16;
      b[b.used++] = (int & 0x0000FF00) >> 8;
      b[b.used++] = (int & 0x000000FF) >> 0;
      break;


    // long long
    case 8:
      b[b.used++] = (int & 0xFF00000000000000) >> 56;
      b[b.used++] = (int & 0x00FF000000000000) >> 48;
      b[b.used++] = (int & 0x0000FF0000000000) >> 40;
      b[b.used++] = (int & 0x000000FF00000000) >> 32;
      b[b.used++] = (int & 0x00000000FF000000) >> 24;
      b[b.used++] = (int & 0x0000000000FF0000) >> 16;
      b[b.used++] = (int & 0x000000000000FF00) >> 8;
      b[b.used++] = (int & 0x00000000000000FF) >> 0;
      break;

    default:
      return emitError(emitter,"Bad size");
  }
}


function serializeShortString (b, string, emitter) {
  if (typeof(string) != "string") {
    return emitError(emitter,"param must be a string");
  }
  var byteLength = Buffer.byteLength(string, 'utf8');
  if (byteLength > 0xFF) {
    return emitError(emitter,"String too long for 'shortstr' parameter");
  }
  if (1 + byteLength + b.used >= b.length) {
    return emitError(emitter,"Not enough space in buffer for 'shortstr'");
  }
  b[b.used++] = byteLength;
  b.write(string, b.used, 'utf8');
  b.used += byteLength;
}


function serializeLongString (b, string, emitter) {
  // we accept string, object, or buffer for this parameter.
  // in the case of string we serialize it to utf8.
  if (typeof(string) == 'string') {
    var byteLength = Buffer.byteLength(string, 'utf8');
    serializeInt(b, 4, byteLength, emitter);
    b.write(string, b.used, 'utf8');
    b.used += byteLength;
  } else if (typeof(string) == 'object') {
    serializeTable(b, string, emitter);
  } else {
    // data is Buffer
    var byteLength = string.length;
    serializeInt(b, 4, byteLength, emitter);
    b.write(string, b.used); // memcpy
    b.used += byteLength;
  }
}

function serializeDate(b, date, emitter) {
  serializeInt(b, 8, date.valueOf() / 1000, emitter);
}

function serializeBuffer(b, buffer, emitter) {
  serializeInt(b, 4, buffer.length, emitter);
  buffer.copy(b, b.used, 0);
  b.used += buffer.length;
}

function isBigInt(value) {
  return value > 0xffffffff;
}

function getCode(dec) {
  var hexArray = "0123456789ABCDEF".split('');

  var code1 = Math.floor(dec / 16);
  var code2 = dec - code1 * 16;
  return hexArray[code2];
}

function isFloat(value)
{
  return value === +value && value !== (value|0);
}

function serializeValue (b, value, emitter) {
  switch (typeof(value)) {
    case 'string':
      b[b.used++] = 'S'.charCodeAt(0);
      serializeLongString(b, value, emitter);
      break;

    case 'number':
      if (!isFloat(value)) {
        if (isBigInt(value)) {
          // 64-bit uint
          b[b.used++] = 'l'.charCodeAt(0);
          serializeInt(b, 8, value, emitter);
        } else {
          //32-bit uint
          b[b.used++] = 'I'.charCodeAt(0);
          serializeInt(b, 4, value, emitter);
        }
      } else {
        //64-bit float
        b[b.used++] = 'd'.charCodeAt(0);
        serializeFloat(b, 8, value, false, emitter);
      }
      break;

    case 'boolean':
      b[b.used++] = 't'.charCodeAt(0);
      b[b.used++] = value;
      break;

    default:
    if (value instanceof Date) {
      b[b.used++] = 'T'.charCodeAt(0);
      serializeDate(b, value, emitter);
    } else if (value instanceof Buffer) {
      b[b.used++] = 'x'.charCodeAt(0);
      serializeBuffer(b, value, emitter);
    } else if (util.isArray(value)) {
      b[b.used++] = 'A'.charCodeAt(0);
      serializeArray(b, value, emitter);
    } else if (typeof(value) === 'object') {
      b[b.used++] = 'F'.charCodeAt(0);
      serializeTable(b, value, emitter);
    } else {
      this.throwError("unsupported type in amqp table: " + typeof(value));
    }
  }
}

function serializeTable (b, object, emitter) {
  if (typeof(object) != "object") {
    return emitError(emitter, "param must be an object");
  }

  // Save our position so that we can go back and write the length of this table
  // at the beginning of the packet (once we know how many entries there are).
  var lengthIndex = b.used;
  b.used += 4; // sizeof long
  var startIndex = b.used;

  for (var key in object) {
    if (!object.hasOwnProperty(key)) continue;
    serializeShortString(b, key, emitter);
    serializeValue(b, object[key], emitter);
  }

  var endIndex = b.used;
  b.used = lengthIndex;
  serializeInt(b, 4, endIndex - startIndex, emitter);
  b.used = endIndex;
}

function serializeArray (b, arr, emitter) {
  // Save our position so that we can go back and write the byte length of this array
  // at the beginning of the packet (once we have serialized all elements).
  var lengthIndex = b.used;
  b.used += 4; // sizeof long
  var startIndex = b.used;

  var len = arr.length;
  for (var i = 0; i < len; i++) {
    serializeValue(b, arr[i], emitter);
  }

  var endIndex = b.used;
  b.used = lengthIndex;
  serializeInt(b, 4, endIndex - startIndex, emitter);
  b.used = endIndex;
}

function emitError(emitter, message) {
  err = "string" == typeof message ? new Error(message) : message;
  emitter.emit("error", err);
}

function serializeFields (buffer, fields, args, strict, emitter) {
  var bitField = 0;
  var bitIndex = 0;
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var domain = field.domain;
    if (!(field.name in args)) {
      if (strict) {
        return emitError(emitter, "Missing field '" + field.name + "' of type '" + domain + "' while executing AMQP method '" + arguments.callee.caller.arguments[1].name + "'");
      }
      continue;
    }

    var param = args[field.name];

    //debug("domain: " + domain + " param: " + param);

    switch (domain) {
      case 'bit':
        if (typeof(param) != "boolean") {
          return emitError(emitter, "Unmatched field " + JSON.stringify(field));
        }

        if (param) bitField |= (1 << bitIndex);
        bitIndex++;

        if (!fields[i+1] || fields[i+1].domain != 'bit') {
          //debug('SET bit field ' + field.name + ' 0x' + bitField.toString(16));
          buffer[buffer.used++] = bitField;
          bitField = 0;
          bitIndex = 0;
        }
        break;

      case 'octet':
        if (typeof(param) != "number" || param > 0xFF) {
          return emitError(emitter, "Unmatched field " + JSON.stringify(field));
        }
        buffer[buffer.used++] = param;
        break;

      case 'short':
        if (typeof(param) != "number" || param > 0xFFFF) {
          return emitError(emitter, "Unmatched field " + JSON.stringify(field));
        }
        serializeInt(buffer, 2, param, emitter);
        break;

      case 'long':
        if (typeof(param) != "number" || param > 0xFFFFFFFF) {
          return emitError(emitter, "Unmatched field " + JSON.stringify(field));
        }
        serializeInt(buffer, 4, param, emitter);
        break;

      case 'timestamp':
      case 'longlong':
        serializeInt(buffer, 8, param, emitter);
        break;

      case 'shortstr':
        if (typeof(param) != "string" || param.length > 0xFF) {
          return emitError(emitter, "Unmatched field " + JSON.stringify(field));
        }
        serializeShortString(buffer, param, emitter);
        break;

      case 'longstr':
        serializeLongString(buffer, param, emitter);
        break;

      case 'table':
        if (typeof(param) != "object") {
          return emitError(emitter, "Unmatched field " + JSON.stringify(field));
        }
        serializeTable(buffer, param, emitter);
        break;

      default:
        return emitError(emitter, "Unknown domain value type " + domain);
    }
  }
}
