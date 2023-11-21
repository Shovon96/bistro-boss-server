const express = require('express');
const app = express()
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const userCollection = client.db('bistroBoss').collection('users')
    const paymentCollection = client.db('bistroBoss').collection('payments')


    // jwt releted api 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });
      res.send({ token });
    })

    // middleware varify token
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token',req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorize access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: 'unauthorize access' })
        }
        req.decoded = decoded;
        next()
      })
    }

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    // user releted apis
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user exists:
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result);
    })

    // chack admin or not
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })

    app.delete('/users/:id', verifyAdmin, verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    app.patch('/users/admin/:id', verifyAdmin, verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: { role: 'admin' }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })


    // menus data get apis
    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result)
    })

    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })

    // Go to update field api
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await menuCollection.findOne(query);
      res.send(result)
    })

    // update menu one item api
    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })

    // reviews data get apis
    app.get('/reviews', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })

    // carts releted apis
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem)
      res.send(result)
    })

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })

    // payment intent releted apis
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']

      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment history post db
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // carefully delete each item from the cart
      // console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      };

      const deletedResult = await cartCollection.deleteMany(query)
      res.send({ paymentResult, deletedResult })
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    // stats or analytics
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount()
      const menuItem = await menuCollection.estimatedDocumentCount()
      const ordars = await paymentCollection.estimatedDocumentCount();
      // total payment aggregate or sum
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$price' }
          }
        }
      ]).toArray()
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        menuItem,
        ordars,
        revenue
      })
    })

    // using aggregate paipline
    app.get('/order-stats', async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuItemIds'
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },
        {
          $unwind: '$menuItems'
        },
        {
          $group: {
            _id: '$menuItems.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItems.price' }
          }
        }
      ]).toArray()

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



app.get('/', (req, res) => {
  res.send("Bistro boss is running")
})

app.listen(port, () => {
  console.log(`Bistro boss is runnin on ${port}`);
})