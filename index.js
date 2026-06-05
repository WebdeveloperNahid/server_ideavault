const express = require("express");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
app.use(cors());
app.use(express.json());

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

    ///################@@@@@@@@@@@@@___Data base____@@@@@@@############

    const db = client.db("ideavault");
    const ideasCollection = db.collection("ideas");
    const commentsCollection = db.collection("comments");

    app.get("/ideas", async (req, res) => {
      const { search } = req.query;
      let cursor;
      if (search) {
        cursor = ideasCollection.find({
          ideaTitle: { $regex: search, $options: "i" },
        }); //////////kalke ai  khaner code ta dekte hobe mabe change korte hoite pare
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

    // Comment POST করো
    app.post("/comments", varifyToken, async (req, res) => {
      const { ideaId, text } = req.body;
      const { sub: userId, name, username, email } = req.user;

      if (!ideaId || !text) {
        return res.status(400).json({ message: "ideaId and text required" });
      }

      const comment = {
        ideaId,
        text,
        userId,
        userName: username || name || email,
        createdAt: new Date(),
      };

      const result = await commentsCollection.insertOne(comment);
      res.send({ ...comment, _id: result.insertedId });
    });

    // idea get every comments
    app.get("/comments/:ideaId", async (req, res) => {
      const { ideaId } = req.params;
      const comments = await commentsCollection
        .find({ ideaId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(comments);
    });

    // My Interactions —my all comments

    app.get("/my-comments", varifyToken, async (req, res) => {
      const { sub: userId } = req.user;
      const comments = await commentsCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(comments);
    });

    // Comment EDIT করো
    app.patch("/comments/:commentId", varifyToken, async (req, res) => {
      const { commentId } = req.params; //  commentId nicci
      const { text } = req.body;
      const { sub: userId } = req.user;

      const comment = await commentsCollection.findOne({
        _id: new ObjectId(commentId), // commentsCollection
      });

      if (!comment) return res.status(404).json({ message: "Not found" });
      if (comment.userId !== userId)
        return res.status(403).json({ message: "Forbidden" });

      await commentsCollection.updateOne(
        { _id: new ObjectId(commentId) },
        { $set: { text, updatedAt: new Date() } }, //  text update
      );
      res.send({ message: "Updated" });
    });

    // Comment DELETE করো
    app.delete("/comments/:commentId", varifyToken, async (req, res) => {
      const { commentId } = req.params;
      const { sub: userId } = req.user;

      const comment = await commentsCollection.findOne({
        _id: new ObjectId(commentId),
      });

      if (!comment) return res.status(404).json({ message: "Not found" });
      if (comment.userId !== userId)
        return res.status(403).json({ message: "Forbidden" });

      await commentsCollection.deleteOne({ _id: new ObjectId(commentId) });
      res.send({ message: "Deleted" });
    });

    ////****$$$######### For add-ideas page to add idea card in ideas and my-ideas page */

    //Add idea API

    app.post("/ideas", varifyToken, async (req, res) => {
      const idea = req.body;
      const { sub: userId, username, email, name } = req.user;
      const newIdea = {
        ideaTitle: idea.title,
        shortDescription: idea.shortDesc,
        detailedDescription: idea.detaileDesc,
        category: idea.category,
        imageURL: idea.imageUrl,
        targetAudience: idea.targetAudience,
        problemStatement: idea.problemStatement,
        proposedSolution: idea.proposedSolution,
        userId,
        userName: username || name || email,

        createdAt: new Date(),
      };
      const result = await ideasCollection.insertOne(newIdea);
      res.send({...newIdea,_id:result.insertedId});
    });

    //MY Ideas Api

    app.get("/my-ideas", varifyToken, async (req, res) => {
      const { sub: userId } = req.user;

      const result = await ideasCollection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });



    // comment post for update delete functionality

    // app.patch("/comments/:commentId", varifyToken, async (req, res) => {
    //   const { IdeasId } = req.params;
    //   const enrollmentData = req.body;

    //   const Ideas = await ideasCollection.findOne({
    //     _id: new ObjectId(IdeaId),
    //   }); ///aikahne problem hoite parre  ____ new ObjectId tay aita delet korte hote pare
    //   if (!Ideas) {
    //     res.status(404).json({ message: "Course not found" });
    //   }
    //   (await ideasCollection.updateOne({ _id: new ObjectId(IdeasId) }),
    //     { _id: new ObjectId(IdeasId) },
    //     {
    //       $inc: { postCount: 1 },
    //       $set: {
    //         lastPostsAt: new Date(),
    //       },
    //     });

    //   const result = await postCollection.insertOne({
    //     ...postData,
    //     postsAt: new Date(),
    //   });
    //   res.send(result);
    // });

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
