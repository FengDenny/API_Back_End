module.exports = (fn) => {
  //middleware
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
