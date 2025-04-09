import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const prisma = new PrismaClient();

// Middleware
app.use(cors()); // ✅ now correctly called as a function
app.use(express.json());

// ================== AUTH MIDDLEWARE ==================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // userId lives here
    next();
  });
}

// ================== AUTH ROUTES ==================
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and Password Required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword },
    });

    res.status(201).json({ message: 'User Created' });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(400).json({ error: 'User already exists or invalid input' });
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
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ================== TASK ROUTES ==================
app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.user.userId },
    });
    res.json(tasks);
  } catch (err) {
    console.error('Get Tasks Error:', err);
    res.status(500).json({ error: 'Could not fetch tasks' });
  }
});

app.get('/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const task = await prisma.task.findFirst({
      where: { id: parseInt(id), userId: req.user.userId },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch task' });
  }
});

app.post('/tasks', authenticateToken, async (req, res) => {
  const { title } = req.body;

  if (!title)
    return res.status(400).json({ error: 'Title is required' });

  try {
    const task = await prisma.task.create({
      data: {
        title,
        userId: req.user.userId,
      },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error('Create Task Error:', err);
    res.status(500).json({ error: 'Could not create task' });
  }
});

app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, completed } = req.body;

  try {
    const existingTask = await prisma.task.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user.userId,
      },
    });

    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: {
        ...(title !== undefined && { title }),
        ...(completed !== undefined && { completed }),
      },
    });

    res.json(updatedTask);
  } catch (err) {
    console.error('Update Task Error:', err);
    res.status(500).json({ error: 'Could not update task' });
  }
});

app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existingTask = await prisma.task.findFirst({
      where: { id: parseInt(id), userId: req.user.userId },
    });

    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    await prisma.task.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ================== START SERVER ==================
app.get('/', (req, res) => {
  res.send('✅ Task Manager API is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
