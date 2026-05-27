(function(){
  window.__RCA_DEBUG = true;
  const log = (...args)=>console.log('[RCA_DEBUG]',...args);
window.addEventListener('DOMContentLoaded', ()=>{
    console.log('RCA_DEBUG dom ready');
    const ids = ['uploadBtn','menuToggle','searchBtn','sidebarStudio','sidebarMod','sidebarAdmin','likeBtn','subscribeBtn','signInBtn','signUpForm','signInForm'];
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return log('missing',id);
      log('exists',id,'display=',getComputedStyle(el).display);
      el.addEventListener('click',()=>log('clicked',id),{capture:true});
    });
    log('hash=',location.hash);
    log('token=',localStorage.getItem('rca_token'));
  });
})();

