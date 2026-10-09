const http = require("http"), fs = require("fs"), path = require("path");
const file = path.join(__dirname, "sheet.csv");
http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/csv; charset=utf-8" });
  res.end(fs.readFileSync(file));
}).listen(8799, "127.0.0.1", () => console.log("csv on 8799"));
