require('dotenv').config(); // make sure this is at the top of the file
const express = require("express"); // we want to use express
const app = express(); // create an instance of express as app parent
const PORT = process.env.PORT || 3000;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');



const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

//Middlesware to parse JSON
app.use(express.json()); //Tells the program how to interp incomming json packs

//In-memory "database"
let tasks = [];
let idCounter = 1;

// Get all tasks

app.get('/tasks', authenticateToken ,async (req, res) => {

    try{

        const tasks = await prisma.task.findMany({where: {userid: req.user.id}});
        res.json(tasks);
    }
    catch(err)
    {
      console.error('❌ Get Tasks Error:', err);
      res.status(500).json({ error: 'Could not fetch tasks' });
    }
})

// Post new task

app.post('/tasks', authenticateToken, async (req, res) => {
  const { title } = req.body;

  if (!title) {
    console.log('❌ Missing title in request body');
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const task = await prisma.task.create({
      data: {
        title,
        userID: req.user.userId, // Might be undefined
      },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error('❌ Create Task Error:', err); // LOG HERE
    res.status(500).json({ error: 'Could not create task' });
  }
});
//GET task by id
app.get('/tasks/:id', authenticateToken ,async (req, res) => {

  const {id} = req.params;

   try
   {
        const task = await prisma.task.findFirst({where: {id: parseInt(id), userID: req.user.id}});
        if(!task) return res.status(404).json({error: 'Task not Found'});

        res.json(task);
   }
   catch(err)
   {
        res.status(500).json({error: 'could not fetch task'});
   }
});

// PUT update task
app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, completed } = req.body;

  try {
    const existingTask = await prisma.task.findFirst({
      where: {
        id: parseInt(id),
        userID: req.user.userId
      }
    });

    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(completed !== undefined && { completed })
      }
    });

    res.json(updatedTask);
  } catch (err) {
    console.error('❌ Update Task Error:', err);
    res.status(500).json({ error: 'Could not update task' });
  }
});
//DELETE task
app.delete('/tasks/:id', authenticateToken ,async (req, res) => {

   const {id} = req.params;

   try
   {
        const existingTask = await prisma.task.findFirst({where: {id: parseInt(id), userID: req.user.userId}});

        if(!existingTask) return res.status(404).json({error: 'Task Not Found'});

        await prisma.task.delete({
          where: { id: parseInt(id) }
        });

        res.json({message: 'Task Deleted'});
   }
   catch(err)
   {
    res.status(404).json({error: 'Failed to delete task'});
   }
});

//START server

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit();
});


//Used for auth

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expecting: Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    req.user = user; // contains userId
    next();
  });
}







app.post('/signup', async (req, res) => {

    const {email, password} = req.body;

    if(!email || !password) return res.status(400).json({error: 'Email and Password Required'});
    
    try
    {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {email, password: hashedPassword},
        });

        res.status(201).json({message: 'User Created'});
    }

    catch(err)
    {
        res.status(404).json({error: 'User already exists or invalid input'});
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
  
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
  
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: 'Login failed' });
    }
  });