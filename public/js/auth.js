// auth.js - shared auth helpers (Linear/Notion-style: simple, predictable)
(function(){
  'use strict';

  var TOKEN_KEY = 'authToken';

  function getAuthToken(){
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
    return '';
  }

  function clearAuth(){
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
    try { localStorage.removeItem('user'); } catch (e) {}
  }

  function redirectToLogin(reason){
    try {
      var url = window.location.origin + '/login.html';
      if (reason) {
        try { sessionStorage.setItem('team_management:lastAuthError', String(reason).slice(0, 200)); } catch (e) {}
      }
      // use replace to avoid back-loop
      window.location.replace(url);
    } catch (e) {
      try { window.location.href = '/login.html'; } catch (e2) {}
    }
  }

  async function authFetch(url, options){
    options = options || {};
    options.headers = options.headers || {};
    var token = getAuthToken();
    if (!token) {
      redirectToLogin('无 token');
      throw new Error('NO_TOKEN');
    }
    options.headers.Authorization = 'Bearer ' + token;

    var res = await fetch(url, options);
    if (res && res.status === 401) {
      clearAuth();
      redirectToLogin('token 失效');
      throw new Error('UNAUTHORIZED');
    }
    return res;
  }

  window.Auth = {
    TOKEN_KEY: TOKEN_KEY,
    getAuthToken: getAuthToken,
    clearAuth: clearAuth,
    redirectToLogin: redirectToLogin,
    authFetch: authFetch,
  };
})();
