import { ParserStream, ParseError } from '@scratchyone/command_parser';
import parse from 'parse-duration';
import { Context } from './types';

export const Types = {
  string: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    let buffer = '';
    while (!command.atEnd) {
      buffer += command.consume();
    }
    if (buffer.length == 0)
      throw new ParseError(
        command.count,
        'Expected string, found end of command'
      );
    return { stream: command, result: buffer };
  },
  word: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    let buffer = '';
    while (command.peek() != ' ' && !command.atEnd) {
      buffer += command.consume();
    }
    if (buffer.length == 0)
      throw new ParseError(
        command.count,
        'Expected word, found end of command'
      );
    return { stream: command, result: buffer };
  },
  channel_id: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    return extract_generic_id(
      command,
      ctx,
      /<#(?<id>\d+)>/,
      'channel',
      ctx.msg.guild?.channels.cache.array(),
      ctx.msg.guild?.channels.cache.array().map((c) => [c.name, c.id]) || []
    );
  },
  user_id: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    return extract_generic_id(
      command,
      ctx,
      /<@!?(?<id>\d+)>/,
      'user',
      undefined,
      ctx.msg.guild?.members.cache.array().map((c) => [c.user.tag, c.id]) || []
    );
  },
  role_id: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    return extract_generic_id(
      command,
      ctx,
      /<@&(?<id>\d+)>/,
      'role',
      ctx.msg.guild?.roles.cache.array(),
      ctx.msg.guild?.roles.cache.array().map((c) => [c.name, c.id]) || []
    );
  },
  channel: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    const res = Types.channel_id(command, ctx);
    return {
      stream: res.stream,
      result: ctx.msg.guild?.channels.cache.get(res.result),
    };
  },
  member: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    const res = Types.user_id(command, ctx);
    return {
      stream: res.stream,
      result: ctx.msg.guild?.members.cache.get(res.result),
    };
  },
  role: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    const res = Types.role_id(command, ctx);
    return {
      stream: res.stream,
      result: ctx.msg.guild?.roles.cache.get(res.result),
    };
  },
  duration: (
    command: ParserStream<string>,
    ctx: Context
  ): { stream: ParserStream<string>; result: any } => {
    let buffer = '';
    while (command.peek() != ' ' && !command.atEnd) {
      buffer += command.consume();
    }
    const ms = parse(buffer, 'ms');
    if (ms === null || ms === 0)
      throw new ParseError(command.count, `Invalid timeframe "${buffer}"`);
    return {
      stream: command,
      result: ms,
    };
  },
};
function extract_generic_id<T>(
  command: ParserStream<string>,
  ctx: Context,
  regex: RegExp,
  error_name: string,
  limit_to: { id: string }[] | undefined,
  aliases: [string, string][]
): { stream: ParserStream<string>; result: string } {
  for (const alias of aliases) {
    if (command.nextn(alias[0].length).join('') == alias[0]) {
      command.consumen(alias[0].length);
      return {
        stream: command,
        result: alias[1],
      };
    }
  }
  let buffer = '';
  while (command.peek() != ' ' && !command.atEnd) {
    buffer += command.consume();
  }
  if (parseInt(buffer) && (!limit_to || limit_to.find((n) => n.id == buffer)))
    return { stream: command, result: buffer };
  else if (
    regex.test(buffer) &&
    (!limit_to || limit_to.find((n) => n.id == buffer.match(regex)?.groups?.id))
  )
    return {
      stream: command,
      result: buffer.match(regex)?.groups?.id,
    };
  else throw new ParseError(command.count, 'Expected ' + error_name);
}

function extract_until_space(
  command: ParserStream<string>
): { stream: ParserStream<string>; result: any } {
  let buffer = '';
  while (command.peek() != ' ' && !command.atEnd) {
    console.log('Consumed: ' + '"' + command.peek() + '"');
    buffer += command.consume();
  }
  return { stream: command, result: buffer };
}
