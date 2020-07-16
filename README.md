# Bergx SDK

The offical Bergx SDK for Javascript, works on browsers, mobile devices and node.js.

Bergx is a set of modules to get you moving quickly on your next project.

* User Authentication
* Authorization
* Feature Switches
* Advanced A/B Testing

## Getting Started

Create an account here: https://www.bergx.io Just follow the quick start to create an organization and an application. You will need to create a client in order to interact with the API.

```bash
npm install bergx-sdk
# or
yarn add bergx-sdk
```

### Usage

```javascript
const bx = new BergxSDK({
  clientId: '{{clientId}}',
  clientSecret: '{{clientSecret}}',
});

// Feature Switch example
const createRes = await bx.createSwitch({
	name: "awesome-feature",
	type: "basic",
	value: "true"
});
const awesomeFeature = await bx.checkSwitch('awesome-feature', {username: 'cool guy'});
console.log(awesomeFeature); // true
```

## API

Documentation of the raw api can be found here: https://documenter.getpostman.com/view/1097302/SWLmW44o?version=latest

There are four basic modules provided by the Bergx SDK, User Authentication, User Authorization, Feature Switches, and Advanced A/B testing. Each module has its own section below.

### Initialization

##### Creating a new Bergx instance

The SDK is provided in a single class and is initialized using the BxConfig type. Everything is Javascript or Typescript compatible.

*Types:*

**BxConfig Object:**

| Property | Type | Required | Explanation |
| --- | --- | --- | --- |
| clientId | string | true | The clientId is provided from the [bergx.io](https://p01.bergx.io) console when a new client is created there. |
| clientSecret | string | true | The clientSecret is provided from the [bergx.io](https://p01.bergx.io) console when a new client is created there. |
| host | string | false | You can specify another provider's location as long as they implement the BergxAPI |
| updateAccessTokenCallback | function: `(userSub: string, newAccessToken: string) => void` | false | Optionally, provide a callback to update your database with a user's `id` aka `sub` and a new `accessToken`. |

Example:

```typescript
interface BxConfig {
  clientId: string;
  clientSecret: string;
  host?: string;
  updateAccessTokenCallback?: (userSub: string, newAccessToken: string) => void;
}

const bx = new BergxSDK({
  clientId: '{{clientId}}',
  clientSecret: '{{clientSecret}}',
  host: 'https://p01.bergx.io',
  updateAccessTokenCallback: (userSub: string, newAccessToken: string) => {
    db.saveUser({userId: userSub, accessToken: newAccessToken});
  }
});
```

Once the SDK has been initialized with a `clientId` and `secret` most calls will automatically authenticate. But any calls to the user profile endpoints will require `accessTokens` that are scoped to the user rather than the client. For information on how to use the **User Authentication** module refer to the example project in `./examples/`.

### User Authentication/Profile

*Types:*

**BxUser Object:**

| Property | Type | Required | Explanation |
| --- | --- | --- | --- |
| accessToken | string | true | The active `accessToken` for a given user. |
| refreshToken | string | false | The `refreshToken` allows you to renew an expired `accessToken`. |

```typescript
interface BxUser {
  accessToken: string;
  refreshToken: string;
}
```

**User Object:**

| Property | Type | Required | Explanation |
| --- | --- | --- | --- |
| claims | BxUserClaims | true | The user profile information, generally known as `claims`, associated with the user. |
| organizations | string[] | true | An array of IDs for organizations the user is a member of in the Bergx Console. |

```typescript
interface User {
  claims: BxUserClaims;
  organizations: string[];
}
```

**BxUserClaims Object:**

`BxUserClaims` is based on the OpenID Connect Standard user claims object. Please refer to the OpenID Connect Claims object documentation for more details https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims.

| Property | Type | Required | Explanation |
| --- | --- | --- | --- |
| email | string | true | User's email. |
| sub | string | true | User's id or 'sub'-scriber id. |
| ... | ... | ... | ... |

All other [standard claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims) are supported.

#### getProfile(user: BxUser): Promise<{status: string, user: User}>

Returns a `status` (string) and a `User` object.

Example response:
```json
{
  "status": "success",
  "user": {
    "claims": {
      "email": "testUser@example.com",
      "updated_at": 1588647477,
      "preferred_username": "testUser",
      "sub": "{{uuid}}",
      "email_verified": true
    },
    "organizations": []
  }
}
```

Usage:

```typescript
const user = await bx.getProfile({
  accessToken,
  refreshToken
});
```

#### updateProfile(user: BxUser, data: BxUserClaims)

Updates the user profile in Bergx. Requires a user's `accessToken`.
