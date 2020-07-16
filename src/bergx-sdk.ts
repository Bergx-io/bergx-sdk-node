import jwt from 'jsonwebtoken';
import Debug from 'debug';

const fetch = require('cross-fetch');
const debug = Debug('bergxSDK:all');

class BergxSDK {
  private host: string;
  private clientId: string;
  private clientSecret: string;
  private updateAccessTokenCallback: (userSub: string, newAccessToken: string) => void = this.updateAccessTokenWarning.bind(this);

  private clientAccessToken: string | null = null;

  private fetch = fetch;

  constructor(config: BxConfig) {

    this.host = config.host || 'https://p01.bergx.io';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    if (!!config.updateAccessTokenCallback) {
      this.updateAccessTokenCallback = config.updateAccessTokenCallback;
    }
  }

  private updateAccessTokenWarning(userSub: string, newAccessToken: string) {
    debug(`WARN: nothing configured for updateAccessTokenCallback `);
  }

  public refreshAccessToken(refreshToken: string) {
    return this.clientSecretRequest<OAuthTokenResponse>(`/oauth/refresh`, 'POST', {
      refresh_token: refreshToken
    }).then((body: OAuthTokenResponse) => {
      return body.access_token;
    });
  }

  public getNewClientAccessToken() {
    return this.clientSecretRequest<OAuthTokenResponse>(`/oauth/token`, 'POST', {
      grant_type: "client_credentials"
    }).then((body: OAuthTokenResponse) => {
      this.clientAccessToken = body.access_token;
      return body.access_token;
    });
  }

  public checkAccessToken(accessToken: string, refreshToken: string): Promise<string> {
    // TODO: make refreshToken optional
    let defer: Promise<string> = new Promise((resolve, reject) => {
      if (accessToken && this.isAccessTokenExpired(accessToken) || !accessToken) {
        this.refreshAccessToken(refreshToken).then((newAccessToken: string) => {
          const userSub: string = ''; // TODO: get the userSub
          !!this.updateAccessTokenCallback ? this.updateAccessTokenCallback(userSub, newAccessToken) : null;
          resolve(newAccessToken);
        }).catch(() => {
          reject('Refresh Token is invalid.');
        });
      } else {
        resolve(accessToken);
      }
    });
    return defer;
  }

  public checkClientAccessToken(): Promise<string> {
    let defer: Promise<string> = new Promise((resolve, reject) => {
      if (this.clientAccessToken === null || this.isAccessTokenExpired(this.clientAccessToken)) {
        this.getNewClientAccessToken().then((newAccessToken) => {
          resolve(newAccessToken);
        }).catch((err) => {
          reject('Could not get client accessToken');
        });
      } else {
        resolve(this.clientAccessToken);
      }
    });
    return defer;
  }

  public fetchUserData<T>(accessToken: string, refreshToken: string, url: string, method: string, data?: any): Promise<T> {
    return this.checkAccessToken(accessToken, refreshToken).then((validAccessToken: string) => {
      return this.fetch(`${this.host}${url}`, {
        method: method,
        body: !!data ? JSON.stringify(data) : null,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validAccessToken}`
        }
      }).then((res: any) => res.json())
      .then((json: any) => {
        const info: T = JSON.parse(json);
        return info;
      });
    });
  }

  public fetchClientData<T>(url: string, method: string, data?: any): Promise<T> {
    return this.checkClientAccessToken().then((validAccessToken: string) => {
      return this.fetch(`${this.host}${url}`, {
        method: method,
        body: !!data ? JSON.stringify(data) : null,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validAccessToken}`
        },
      }).then((res: any) => res.json())
      .then((json: any) => {
        const info: T = json;
        if (json.eventIds || json.eventId) {
          return this.listenForEventCompletion(json.eventIds || [json.eventId]).then(() => {
            return info;
          });
        } else {
          return info;
        }
      });
    });
  }

  public listenForEventCompletion(eventIds: string[]): Promise<any> {
    return this.fetchClientData(`/api/v1/events`, 'POST', {events: eventIds});
  }

  public clientSecretRequest<T>(url: string, method: string, data?: any): Promise<T> {
    return this.fetch(`${this.host}${url}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      })
    }).then((res: any) => res.json())
    .then((json: any) => {
      const info: T = json;
      return info;
    });
  }

  private isAccessTokenExpired(accessToken: string) {
    let current_time = new Date().getTime() / 1000;
    let decodedAT: string | {[key: string]: any} | null = jwt.decode(accessToken);
    let answer = false;
    if (typeof decodedAT !== 'string' &&
      decodedAT !== null &&
      !!decodedAT['exp'] &&
      current_time > decodedAT['exp']) {
      answer = true;
    }
    return answer;
  }


  // Profile section
  public getProfile(user: BxUser) {
    return this.fetchUserData(user.accessToken, user.refreshToken, `/api/v1/profile/me`, 'GET');
  }

  public updateProfile(user: BxUser, data: BxUserClaims) {
    return this.fetchUserData(user.accessToken, user.refreshToken, `/api/v1/profile/me`, 'PUT', data);
  }

  // Switch section
  public getSwitches() {
    return this.fetchClientData(`/api/v1/switches/list`, 'GET');
  }

  public createSwitch(data: SwitchDefinition) {
    return this.fetchClientData(`/api/v1/switches/`, 'POST', data);
  }

  public checkSwitch(switchName: string, ctx: Context): Promise<boolean> {
    return this.fetchClientData<{status: string, value: boolean}>(`/api/v1/switches/check/${switchName}`, 'POST', ctx).then((response: {status: string, value: boolean}) => {
      return response.value;
    });
  }

  public checkAllSwitches(ctx: Context={}): Promise<{[key: string]: boolean}> {
    return this.fetchClientData<AllSwitchResponse>(`/api/v1/switches/check/all`, 'POST', ctx).then((response: AllSwitchResponse) => {
      return response.switches;
    });
  }

  public updateSwitch(switchName: string, data: Partial<SwitchDefinition>) {
    return this.fetchClientData(`/api/v1/switches/${switchName}`, 'POST', data);
  }

  public deleteSwitch(switchName: string) {
    return this.fetchClientData(`/api/v1/switches/${switchName}`, 'DELETE');
  }

  // Bandit section
  public getBanditCohorts() {
    return this.fetchClientData(`/api/v1/bandit/`, 'GET');
  }

  public createBanditCohort(data: CohortDefinition) {
    return this.fetchClientData(`/api/v1/bandit/cohort`, 'POST', data);
  }

  public updateBanditCohort(cohortId: string, data: Partial<CohortDefinition>) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}`, 'PUT', data);
  }

  public deleteBanditCohort(cohortId: string) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}`, 'DELETE');
  }

  public tryBanditCohort(cohortId: string): Promise<TryResponse> {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}/try`, 'GET');
  }

  public winBanditCohort(cohortId: string, armName: string) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}/${armName}/win`, 'POST');
  }

  public resetBanditCohort(cohortId: string) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}/reset`, 'POST');
  }
}

interface BxConfig {
  clientId: string;
  clientSecret: string;
  host?: string;
  updateAccessTokenCallback?: (userSub: string, newAccessToken: string) => void;
}

interface OAuthTokenResponse {
  access_token: string;
}

interface BxUser {
  accessToken: string;
  refreshToken: string; // TODO: make refreshToken optional
}

interface BxUserClaims {}

interface Rule {
  property: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
  and?: Rule[];
}

interface RolloutRule {
  property: string;
  epsilon: number;
}

interface SwitchDefinition {
  name: string;
  type: 'basic' | 'ROLLOUT' | 'ADVANCED';
  app: string;
  value?: boolean;
  rules?: Rule[];
  rolloutRule?: RolloutRule;
}

interface Context {
  [key: string]: any;
}

interface CohortDefinition {
  cohortId: string;
  appId: string;
  name: string;
  totalTries: number;
  totalWins: number;
  randomSelections: number;
  epsilon: number;
  resetFrequency: number; // TODO: figure out the best way to do this
  arms: ArmDefinition[];
}

interface ArmDefinition {
  name: string;
  wins: number;
  tries: number;
  lastReset: number; // TODO: figure out the best way to do this
}

interface TryResponse {
  armName: string;
}

interface AllSwitchResponse {
  status: string;
  switches: {[key: string]: boolean};
}

export default BergxSDK;

export {
  BxConfig,
  BxUser,
  BxUserClaims,
  Rule,
  RolloutRule,
  SwitchDefinition,
  Context,
  CohortDefinition,
  ArmDefinition,
  TryResponse
}
