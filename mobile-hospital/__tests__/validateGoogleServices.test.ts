// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateGoogleServicesJson } = require('../scripts/validateGoogleServices.js') as {
  validateGoogleServicesJson: (
    json: unknown,
    expected: { webClientId?: string; androidClientId?: string; expectedPackage?: string }
  ) => string[];
};

const clients = {
  webClientId: '148957600999-k1e8jsn96vg893pifqchvqf241eot688.apps.googleusercontent.com',
  androidClientId: '148957600999-61r14rmr6ncldnnnep4aek6u7froej39.apps.googleusercontent.com'
};

describe('validateGoogleServicesJson', () => {
  it('flags empty oauth_client and project mismatch (current user file shape)', () => {
    const issues = validateGoogleServicesJson(
      {
        project_info: { project_number: '510932988539' },
        client: [
          {
            client_info: {
              android_client_info: { package_name: 'com.agastya.healthcare' }
            },
            oauth_client: []
          }
        ]
      },
      clients
    );

    expect(issues.some((i) => i.includes('oauth_client is empty'))).toBe(true);
    expect(issues.some((i) => i.includes('does not match'))).toBe(true);
  });

  it('passes when oauth clients match package and project', () => {
    const issues = validateGoogleServicesJson(
      {
        project_info: { project_number: '148957600999' },
        client: [
          {
            client_info: {
              android_client_info: { package_name: 'com.agastya.healthcare' }
            },
            oauth_client: [
              {
                client_id: clients.androidClientId,
                client_type: 1,
                android_info: {
                  package_name: 'com.agastya.healthcare',
                  certificate_hash: 'e62f5a89902830da90d44399ab778896290446a7'
                }
              },
              {
                client_id: clients.webClientId,
                client_type: 3
              }
            ]
          }
        ]
      },
      clients
    );

    expect(issues).toEqual([]);
  });
});
