var RateLimiter = require("limiter").RateLimiter
var fs = require("fs")
var https = require("https")
var domain = require("domain")
var path = require("path")

var imageLimiter = new RateLimiter(1, "second")

function Grabber(thread) {
	var self = this
	var eightChan = thread.match(/https?\:\/\/8ch\.net\/(.*)\/res\/(\d*)\.html/)
	if (eightChan) {
		this.board = eightChan[1]
		this.thread = eightChan[2]
		return fs.mkdir(path.join(__dirname, this.board + "_" + this.thread),
			self.getThreadJSON(this.board, this.thread, true))
	}

	var threadInfo = thread.match(/https?\:\/\/boards\.4chan\.org\/(.*)\/thread\/(\d*)/)
	if (!threadInfo)
		return console.log("failed")

	this.board = threadInfo[1]
	this.thread = threadInfo[2]

	fs.mkdir(path.join(__dirname, this.board + "_" + this.thread), self.getThreadJSON(this.board, this.thread))
}

Grabber.prototype.getImages = function(json, eightChan) {
	var self = this
	var threadJSON = JSON.parse(json)
	var posts = threadJSON["posts"]

	var createFun = function(filename, ext, tim) {
		fs.exists(self.board + "_" + self.thread + "/" + tim + ext, function(exists) {
			if (exists)
				return console.log("Already exists: " + tim + ext)
			else
				postCheck()
		})

		var postCheck = function() {
			var options = {
				host: "i.4cdn.org",
				path: "/" + self.board + "/" + tim + ext
			}

			if (eightChan) {
				options = {
					host: "8ch.net",
					path: "/" + self.board + "/src/" + tim + ext
				}
			}

			return imageLimiter.removeTokens(1, function() {
				self.urlRetrieve(https, options, function(code, buffer) {
					fs.writeFile(self.board + "_" + self.thread + "/" + tim + ext, buffer, 'binary', function(err) {
						if (err)
							console.log(err)
						else
							console.log("Got: " + tim + ext)
					})
				})
			})
		}
	}

	for (var i = 0; i < posts.length; i++) {
		if ("filename" in posts[i]) {
			var filename = posts[i]["filename"]
			var ext = posts[i]["ext"]
			var tim = posts[i]["tim"]
			createFun(filename, ext, tim)
		}
	}
};

Grabber.prototype.getThreadJSON = function(board, thread, eightChan) {
	var self = this
	var options = {
		host: "a.4cdn.org",
		path: "/" + board + "/thread/" + thread + ".json"
	}

	if (eightChan) {
		options = {
			host: "8ch.net",
			path: "/" + board + "/res/" + thread + ".json"
		}
	}

	imageLimiter.removeTokens(1, function() {
		self.urlRetrieve(https, options, function(code, json) {
			if (json)
				self.getImages(json, eightChan)
		})
	})
};

Grabber.prototype.urlRetrieve = function(transport, options, callback) {
	var dom = domain.create()
	console.log("Get: " + options.host + options.path)
	dom.on("error", function(err) {
		console.log("Error")
	})
	dom.run(function() {
		var req = transport.request(options, function(res) {
			res.setEncoding("binary")
			var buffer = ""
			res.on("data", function(chunk) {
				buffer += chunk
			})
			res.on("end", function() {
				callback(res.statusCode, buffer)
			})
		})
		req.end()
	})
};

process.argv.forEach(function(val, index, array) {
	if (index < 2)
		return
	new Grabber(val)
})
