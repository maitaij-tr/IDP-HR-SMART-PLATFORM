import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import apiRouter from '../../src/api';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
app.use('/.netlify/functions/api', apiRouter);

export const handler = serverless(app);
