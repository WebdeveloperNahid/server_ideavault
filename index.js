const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
app.use(cors());
const port = process.env.PORT || 8080;

const uri =
  "mongodb+srv://ideavault:QFKuHk7LRacXctad@cluster0.gokgekd.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("ideavault");
    const ideasCollection = db.collection("ideas");

    app.get("/ideas", async (req, res) => {
      const cursor = ideasCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/home",async (req, res) => {
      const cursor = ideasCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result);
    })




    app.get("/ideas/:IdeasId", async (req, res) => {
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
