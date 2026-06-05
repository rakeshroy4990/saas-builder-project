import { parseSslPinJson } from '../src/api/sslPinConfigParse';

describe('parseSslPinJson', () => {
  it('returns null when input is empty', () => {
    expect(parseSslPinJson(undefined)).toBeNull();
    expect(parseSslPinJson('')).toBeNull();
  });

  it('parses host -> hash array map', () => {
    const raw = JSON.stringify({ 'api.example.com': ['hashA', 'hashB'] });
    expect(parseSslPinJson(raw)).toEqual({
      'api.example.com': { publicKeyHashes: ['hashA', 'hashB'], includeSubdomains: false }
    });
  });

  it('parses host -> object with includeSubdomains', () => {
    const raw = JSON.stringify({
      'api.example.com': { publicKeyHashes: ['x'], includeSubdomains: true }
    });
    expect(parseSslPinJson(raw)).toEqual({
      'api.example.com': { publicKeyHashes: ['x'], includeSubdomains: true }
    });
  });
});
