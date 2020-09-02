const utilities = require('./utilities.js');

test('Check ping command', async () => {
  let sendMessage = jest.fn((x) => null);
  let cmd = utilities.commandModule.commands.find((cmd) => cmd.name === 'ping');
  expect(cmd.matcher({ command: 'ping' })).toBe(true);
  expect(cmd.matcher({ command: 'pong' })).toBe(false);
  expect(cmd.permissions({})).toBe(true);
  await cmd.responder(
    {
      channel: { send: sendMessage },
      createdAt: new Date(),
    },
    {}
  );
  expect(sendMessage.mock.calls[0]).toBeTruthy();
  expect(sendMessage.mock.calls[0][0]).toMatch('Pong! Took');
});
test('Check eval command', async () => {
  let sendMessage = jest.fn((x) => null);
  let cmd = utilities.commandModule.commands.find((cmd) => cmd.name === 'eval');
  expect(cmd.matcher({ command: 'eval' })).toBe(true);
  expect(
    cmd.permissions({
      author: { id: '234020040830091265' },
      member: { hasPermission: (x) => x == 'MANAGE_MESSAGES' },
    })
  ).toBe(true);
  expect(
    cmd.permissions({
      author: { id: '234020040830091265' },
      member: { hasPermission: (x) => x != 'MANAGE_MESSAGES' },
    })
  ).toBe(false);
  expect(
    cmd.permissions({
      author: { id: '24020040830091265' },
      member: { hasPermission: (x) => x == 'MANAGE_MESSAGES' },
    })
  ).toBe(false);
  expect(
    cmd.permissions({
      author: { id: '24020040830091265' },
      member: { hasPermission: (x) => x != 'MANAGE_MESSAGES' },
    })
  ).toBe(false);
  expect(
    cmd.permissions({
      author: { id: undefined },
      member: { hasPermission: (x) => x == 'MANAGE_MESSAGES' },
    })
  ).toBe(false);
  expect(
    cmd.permissions({
      author: { id: null },
      member: { hasPermission: (x) => x == 'MANAGE_MESSAGES' },
    })
  ).toBe(false);
  expect(
    cmd.permissions({
      author: {},
      member: { hasPermission: (x) => x == 'MANAGE_MESSAGES' },
    })
  ).toBe(false);
});
test('Check invite command', async () => {
  let sendMessage = jest.fn((x) => null);
  let cmd = utilities.commandModule.commands.find(
    (cmd) => cmd.name === 'invite'
  );
  expect(cmd.matcher({ command: 'invite' })).toBe(true);
  expect(cmd.matcher({ command: 'invitew' })).toBe(false);
  await cmd.responder(
    {
      channel: { send: sendMessage },
    },
    {}
  );
  expect(sendMessage.mock.calls[0][0]).toMatch(
    'https://discord.com/api/oauth2/authorize'
  );
});
