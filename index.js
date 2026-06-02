const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
app.use(cors());
const port = process.env.PORT || 8080;

const uri = process.env.MONGODB_URI;

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);
// console.log(JWKS,"jwks");

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};

const varifyToken = async (req, res, next) => {
  // console.log(req.headers, "from varify token");
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];
  // console.log(token)

  if (!token) {
    return res.status(401).json({ message: "unauthorize" });
  }
  try {
    const JWKS = createRemoteJWKSet(
      new URL("http://localhost:3000/api/auth/jwks"),
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;

    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "unauthorize" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("ideavault");
    const ideasCollection = db.collection("ideas");

    app.get("/ideas", async (req, res) => {
      const { search } = req.query;
      let cursor;
      if (search) {
        cursor = ideasCollection
          .find({
      ideaTitle: { $regex: search, $options: "i" }
    }) ////////////////////////////////////////kalke ai  khaner code ta dekte hobe mabe change korte hoite pare
          // .toArray();
        // res.send();
      } else {
       cursor = ideasCollection.find();
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/home", async (req, res) => {
      const cursor = ideasCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/ideas/:IdeasId", logger, varifyToken, async (req, res) => {
      const { IdeasId } = req.params;
      const query = { _id: IdeasId }; //new Object(IdeasId)  use kora jaitw jothi ---তাহলে MongoDB তে insert করার সময় _id টা real ObjectId হিসেবে দিতে হবে।
      const result = await ideasCollection.findOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
