class ParserStream<T> {
  characters: T[];
  constructor(input: T[]) {
    this.characters = input;
  }
  get atEnd(): boolean {
    return !this.characters.length;
  }
  peek(n?: number): T | undefined {
    if (this.characters.length <= (n || 0)) return undefined;
    return this.characters[n || 0];
  }
  consume(n?: number): T | undefined {
    if (this.characters.length <= (n || 0)) return undefined;
    const tmp = this.peek(n);
    this.characters.splice(n || 0, 1);
    return tmp;
  }
  nextn(n: number): T[] {
    return this.characters.slice(0, n);
  }
  consumen(n: number): T[] {
    const tmp = this.nextn(n);
    for (let i = 0; i < n; i++) this.consume();
    return tmp;
  }
}
interface Variable {
  name: string;
  type: 'variable';
}
export function parsePrompt(inputStr: string): Array<string | Variable> {
  const input: ParserStream<string> = new ParserStream(inputStr.split(''));
  const output: Array<string | Variable> = [];
  let stringBuffer = '';
  let inTag = false;
  while (!input.atEnd) {
    if (input.peek() === '{' && input.peek(1) === '{') {
      output.push(stringBuffer);
      stringBuffer = '';
      inTag = true;
      input.consume();
      input.consume();
    } else if (inTag && input.peek() === '}' && input.peek(1) === '}') {
      inTag = false;
      output.push({ name: stringBuffer, type: 'variable' });
      stringBuffer = '';
      input.consume();
      input.consume();
    } else {
      stringBuffer += input.consume();
    }
  }
  if (inTag) output.push('{{');
  output.push(stringBuffer);
  const cleanedOutput: Array<string | Variable> = [];
  let i = 0;
  for (const item of output) {
    if (i === 0) {
      cleanedOutput.push(output[i]);
      i++;
    } else {
      if (
        typeof cleanedOutput[i - 1] === 'string' &&
        typeof item === 'string'
      ) {
        cleanedOutput[i - 1] += item;
      } else {
        cleanedOutput.push(item);
        i++;
      }
    }
  }
  return cleanedOutput.filter(Boolean);
}
export function parseText(
  text: string,
  promptTree: Array<string | Variable>
): [boolean, Map<string, string | null>] {
  const parserSyntax: ParserStream<string | Variable> = new ParserStream(
    promptTree
  );
  const parserInput: ParserStream<string> = new ParserStream(text.split(''));
  const parserVars: Map<string, string | null> = new Map();
  let matched = true;
  while (!parserSyntax.atEnd && matched === true) {
    const next = parserSyntax.peek();
    const next1 = parserSyntax.peek(1);
    if (typeof next === 'string') {
      const consumed = parserInput.consumen(next.length);
      if (consumed.join('') !== next) matched = false;
    } else if (next?.type === 'variable') {
      let buffer = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        buffer += parserInput.consume() || '';
        if (
          typeof next1 === 'string' &&
          parserInput.nextn(next1.length).join('') === next1
        ) {
          break;
        } else {
          if (parserInput.peek() === undefined) break;
        }
      }
      parserVars.set(next.name, buffer || null);
    }
    parserSyntax.consume();
  }
  if (matched && !parserInput.atEnd) matched = false;
  return [matched, parserVars];
}
