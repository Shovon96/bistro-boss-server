const express = require('express');
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion } = require('mongodb');

// middleWare
app.use(cors())
app.use(express.json())


const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-phmeoes-shard-00-00.riywk8u.mongodb.net:27017,ac-phmeoes-shard-00-01.riywk8u.mongodb.net:27017,ac-phmeoes-shard-00-02.riywk8u.mongodb.net:27017/?ssl=true&replicaSet=atlas-dhaabf-shard-0&authSource=admin&retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
console.log('connect with mongodb');
    // collections
    const menuCollection = client.db('bistroBoss').collection('menu')
    const reviewCollection = client.db('bistroBoss').collection('reviews')
    const cartCollection = client.db('bistroBoss').collection('carts')

    // menus data get apis
    app.get('/menu', async (req, res)=> {
        const result = await menuCollection.find().toArray()
        res.send(result)
    })

    // reviews data get apis
    app.get('/reviews', async (req, res)=> {
        const result = await reviewCollection.find().toArray()
        res.send(result)
    })

    // carts releted apis
    app.post('/carts', async(req, res)=>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res)=> {
    res.send("Bistro boss is running")
})

app.listen(port, ()=> {
    console.log(`Bistro boss is runnin on ${port}`);
})