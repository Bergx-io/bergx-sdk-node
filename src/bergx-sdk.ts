import jwt from 'jsonwebtoken';
import request from 'request';
import Debug from 'debug';

const debug = Debug('bergxSDK:all');

class BergxSDK {
  private host: string;
  private clientId: string;
  private clientSecret: string;
  private updateAccessTokenCallback: (userSub: string, newAccessToken: string) => void = this.updateAccessTokenWarning.bind(this);

  private clientAccessToken: string | null = null;

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
      let defer: Promise<T> = new Promise((resolve, reject) => {
        request({
          url: `${this.host}${url}`,
          method: method,
          form: data,
          headers: {
            'Authorization': `Bearer ${validAccessToken}`
          }
        }, (error, response, body) => {
          if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            const info: T = JSON.parse(body);
            resolve(info);
          } else {
            reject(body);
          }
        });
      });
      return defer;
    });
  }

  public fetchClientData<T>(url: string, method: string, data?: any): Promise<T> {
    return this.checkClientAccessToken().then((validAccessToken: string) => {
      var defer: Promise<T> = new Promise((resolve, reject) => {
        request({
          url: `${this.host}${url}`,
          method: method,
          form: {
            ...data
          },
          headers: {
            'Authorization': `Bearer ${validAccessToken}`
          }
        },
        (error, response, body) => {
          if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            const info: T = JSON.parse(body);
            resolve(info);
          } else {
            reject(body);
          }
        });
      });
      return defer;
    });
  }

  public clientSecretRequest<T>(url: string, method: string, data?: any): Promise<T> {
    var defer: Promise<T> = new Promise((resolve, reject) => {
      request({
        url: `${this.host}${url}`,
        method: method,
        form: {
          ...data,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }
      },
      (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
          const info = JSON.parse(body);
          resolve((info as T));
        } else {
          reject(body);
        }
      });
    });
    return defer;
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

  public checkSwitch(switchName: string, ctx: Context) {
    return this.fetchClientData(`/api/v1/switches/check/${switchName}`, 'POST', ctx);
  }

  public checkAllSwitches(ctx: Context) {
    return this.fetchClientData(`/api/v1/switches/check/all`, 'POST', ctx);
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
