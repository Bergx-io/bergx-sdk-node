var userService = require('../user/userService');
var jwt = require('jsonwebtoken');
var request = require('request');

// The BergxService class is the official supported Javascript library
// for interacting with Bergx services and modules
class BergxService {

  constructor(config, updateAccessTokenCallback) {
    // callback should expect the following params
    // userSub: string
    // accessToken: string - the new accesstoken
    this.updateAccessTokenCallback = updateAccessTokenCallback;
    this.clientAccessToken = null;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.host = config.host || 'https://p01.bergx.io';
  }

  refreshAccessToken(refreshToken) {
    return this.clientSecretRequest(`/oauth/refresh`, 'POST', {
      refresh_token: refreshToken
    }).then((body) => {
      // TODO: make this not attached to the userService
      return body.accessToken;
    });
  }

  getNewClientAccessToken() {
    return this.clientSecretRequest(`/oauth/token`, 'POST', {
      grant_type: "client_credentials"
    }).then((body) => {
      this.clientAccessToken = body.access_token;
      return body.access_token;
    });
  }

  checkAccessToken(accessToken, refreshToken) {
    let defer = new Promise((resolve, reject) => {
      if (accessToken && this._isAccessTokenExpired(accessToken) || !accessToken) {
        this.refreshAccessToken(refreshToken).then((newAccessToken) => {
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

  checkClientAccessToken() {
    let defer = new Promise((resolve, reject) => {
      if (this.clientAccessToken === null || this._isAccessTokenExpired(this.clientAccessToken)) {
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

  _isAccessTokenExpired(accessToken) {
    let current_time = new Date().getTime() / 1000;
    let decodedAT = jwt.decode(accessToken);
    let answer = false;
    if (current_time > decodedAT.exp) {
      answer = true;
    }
    return answer;
  }

  fetchUserData(accessToken, refreshToken, url, method, data) {
    return this.checkAccessToken(accessToken, refreshToken).then((validAccessToken) => {
      let defer = new Promise((resolve, reject) => {
        request({
          url: `${this.host}${url}`,
          method: method,
          form: data,
          headers: {
            'Authorization': `Bearer ${validAccessToken}`
          }
        }, (error, response, body) => {
          if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            const info = JSON.parse(body);
            resolve(info);
          } else {
            reject(body);
          }
        });
      });
      return defer;
    });
  }

  fetchClientData(url, method, data) {
    return this.checkClientAccessToken().then((validAccessToken) => {
      var defer = new Promise((resolve, reject) => {
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
            const info = JSON.parse(body);
            resolve(info);
          } else {
            reject(body);
          }
        });
      });
      return defer;
    });
  }

  clientSecretRequest(url, method, data) {
    var defer = new Promise((resolve, reject) => {
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
          resolve(info);
        } else {
          reject(body);
        }
      });
    });
    return defer;
  }

  getProfile(user) {
    return this.fetchUserData(user.accessToken, user.refreshToken, `/api/v1/profile/me`, 'GET');
  }

  updateProfile(user, data) {
    return this.fetchUserData(user.accessToken, user.refreshToken, `/api/v1/profile/me`, 'PUT', data);
  }

  // Switches module
  getSwitches() {
    return this.fetchClientData(`/api/v1/switches/list`, 'GET');
  }

  createSwitch(data) {
    return this.fetchClientData(`/api/v1/switches/`, 'POST', data);
  }

  checkSwitch(switchName, ctx) {
    return this.fetchClientData(`/api/v1/switches/check/${switchName}`, 'POST', ctx);
  }

  checkAllSwitches(ctx) {
    return this.fetchClientData(`/api/v1/switches/check/all`, 'POST', ctx);
  }

  updateSwitch(switchName, data) {
    return this.fetchClientData(`/api/v1/switches/${switchName}`, 'POST', data);
  }

  deleteSwitch(switchName) {
    return this.fetchClientData(`/api/v1/switches/${featureSwitchName}`, 'DELETE');
  }

  // Bandit Module
  getBanditCohorts() {
    return this.fetchClientData(`/api/v1/bandit/`, 'GET');
  }

  createBanditCohort(data) {
    return this.fetchClientData(`/api/v1/bandit/cohort`, 'POST', data);
  }

  updateBanditCohort(cohortId, data) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}`, 'PUT', data);
  }

  deleteBanditCohort(cohortId) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}`, 'DELETE');
  }

  tryBanditCohort(cohortId) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}/try`, 'GET');
  }

  winBanditCohort(cohortId, armName) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}/${armName}/win`, 'POST');
  }

  resetBanditCohort(cohortId) {
    return this.fetchClientData(`/api/v1/bandit/cohort/${cohortId}/reset`, 'POST');
  }
}

module.exports = BergxService;
