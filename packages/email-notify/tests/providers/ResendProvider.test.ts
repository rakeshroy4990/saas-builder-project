import { ResendProvider } from '../../src/providers/ResendProvider';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendMock,
    },
  })),
}));

describe('ResendProvider', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('calls resend SDK with correct params', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const provider = new ResendProvider('re_test');

    await provider.send({
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hello</p>',
      text: 'Hello',
    });
  });

  it('returns success with messageId on 200', async () => {
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    const provider = new ResendProvider('re_test');

    await expect(
      provider.send({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hello</p>',
      })
    ).resolves.toEqual({ success: true, messageId: 'msg_1' });
  });

  it('returns failure with error message on API error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'bad request' } });
    const provider = new ResendProvider('re_test');

    await expect(
      provider.send({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hello</p>',
      })
    ).resolves.toEqual({ success: false, error: 'bad request' });
  });

  it('catches unexpected exceptions and wraps them', async () => {
    sendMock.mockRejectedValue(new Error('network down'));
    const provider = new ResendProvider('re_test');

    await expect(
      provider.send({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hello</p>',
      })
    ).resolves.toEqual({ success: false, error: 'network down' });
  });
});
