module.exports = bound;
// http://webreflection.blogspot.com/2012/11/my-name-is-bound-method-bound.html
function bound(methodName) {
  var boundName = "__bound__" + methodName;
  return this[boundName] || (
    this[boundName] = this[methodName].bind(this)
  );
}