const getHelloWorld = (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Hello World",
    timestamp : Date.now()
  });
};

export { getHelloWorld };