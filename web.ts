import * as Types from './types';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import { Client } from 'discord.js';
import moment from 'moment';
import parse from 'parse-duration';
import nanoid from 'nanoid';
import { schedule_event } from './util_functions';
const git = require('git-rev-sync');
const version = require('./package.json').version;
const git_msg = git.message();
const startTime = Date.now() / 1000;
export async function serve(client: Client): Promise<void> {
  if (process.env.PORT) {
    const cors = require('cors');
    const app = express();
    app.use(cors());
    app.use(express.json());
    const port = process.env.PORT;
    app.get('/capabilities/:token', async (req, res) => {
      const capabilities = await Types.Capability.query().where(
        'token',
        req.params.token
      );
      if (!capabilities.length || capabilities[0].expire < Date.now()) {
        res.status(404).send({
          error: 'Capability URL not found',
        });
        return;
      }
      const capability = capabilities[0];
      if (!capability) return;
      res.send({
        expire: capability.expire,
        type: capability.type,
        user: capability.user,
      });
    });
    app.get('/users/:user/reminders', async (req, res) => {
      const capability = await checkCapabilityToken(
        req,
        res,
        req.params.user,
        'reminders'
      );
      if (!capability) return;
      res.send(
        (await Types.Reminder.query().where('author', req.params.user))
          .filter((r) => (r.time || 0) > Date.now() / 1000)
          .map((r) => {
            return {
              author: r.author,
              id: r.id,
              text: r.text || '',
              time: (r.time || 0) * 1000,
            };
          })
          .filter((r) => r.time)
      );
    });
    app.post('/users/:user/reminders', async (req, res) => {
      const capability = await checkCapabilityToken(
        req,
        res,
        req.params.user,
        'reminders'
      );
      if (!capability) return;
      const id = nanoid.nanoid(5);
      res.send(
        await Types.Reminder.query().insertAndFetch({
          text: req.body.text.replace('@', '@ '),
          time: moment().add(parse(req.body.time, 'ms'), 'ms').unix(),
          author: req.params.user,
          id,
        })
      );
      await schedule_event(
        {
          type: 'reminder',
          text: req.body.text.replace('@', '@ '),
          time: moment().add(parse(req.body.time, 'ms'), 'ms').unix(),
          user: req.params.user,
          id,
        },
        req.body.time
      );
    });
    app.get('/users/:user/', async (req, res) => {
      const capability = await checkCapabilityToken(
        req,
        res,
        req.params.user,
        'reminders'
      );
      if (!capability) return;
      const uo = await client.users.fetch(req.params.user);
      res.send({
        id: uo.id,
        tag: uo.tag,
        avatar: uo.displayAvatarURL(),
        username: uo.username,
      });
    });
    app.get('/admin/', async (req, res) => {
      const capability = await checkCapabilityTokenNU(req, res, 'admin');
      if (!capability) return;
      res.send({
        version,
        uptime: startTime,
        guilds: client.guilds.cache.array().length,
        users: client.users.cache.array().length,
        commit_short: git.short(),
        commit_msg: git_msg,
      });
    });
    app.post('/admin/stop', async (req, res) => {
      const capability = await checkCapabilityTokenNU(req, res, 'admin');
      if (!capability) return;
      res.send({});
      process.exit(0);
    });
    app.get('/features', async (req, res) => {
      res.send(['addReminders']);
    });
    app.delete('/users/:user/reminders/:id', async (req, res) => {
      const capability = await checkCapabilityToken(
        req,
        res,
        req.params.user,
        'reminders'
      );
      if (!capability) return;
      const changes = await Types.Reminder.query()
        .where('author', req.params.user)
        .where('id', req.params.id)
        .delete();
      if (changes) res.status(200).send({ success: true });
      else res.status(404).send({ error: 'Reminder not found' });
    });
    app.listen(port, () => {
      console.log(`API listening at http://localhost:${port}`);
    });
  }
}
async function checkCapabilityToken(
  req: express.Request,
  res: express.Response,
  user: string,
  type: 'reminders'
): Promise<false | Types.Capability> {
  const capabilities = await Types.Capability.query().where(
    'token',
    req.headers.authorization?.replace('Bearer ', '') || ''
  );
  if (!capabilities.length || capabilities[0].expire < Date.now()) {
    res.status(401).send({
      error: 'Capability token not valid',
    });
    return false;
  }
  if (capabilities[0].user !== user || capabilities[0].type !== type) {
    res.status(403).send({
      error: 'Capability token does not have permission to request that data',
    });
    return false;
  }
  return capabilities[0];
}
async function checkCapabilityTokenNU(
  req: express.Request,
  res: express.Response,
  type: 'reminders' | 'admin'
): Promise<false | Types.Capability> {
  const capabilities = await Types.Capability.query().where(
    'token',
    req.headers.authorization?.replace('Bearer ', '') || ''
  );
  if (!capabilities.length || capabilities[0].expire < Date.now()) {
    res.status(401).send({
      error: 'Capability token not valid',
    });
    return false;
  }
  if (capabilities[0].type !== type) {
    res.status(403).send({
      error: 'Capability token does not have permission to request that data',
    });
    return false;
  }
  return capabilities[0];
}
export async function mintCapabilityToken(
  user: string,
  type: 'reminders' | 'admin'
): Promise<string> {
  const token = uuidv4().replace(/-/g, '');
  await Types.Capability.query().insert({
    expire: Date.now() + 86400000,
    user,
    type,
    token,
  });
  return token;
}
