/**
 * Source code of the "Import to Next Job Spy" bookmarklet. The user drags
 * this from /settings into their bookmarks bar; clicking it on any job
 * posting page (logged-in LinkedIn, Indeed, Glassdoor, or anywhere else)
 * reads the rendered DOM in their session and ships it to Next Job Spy.
 *
 * Transport: open a popup tab on our origin (/clip), postMessage the
 * extracted payload across. Why not a direct cross-origin form POST?
 * LinkedIn (and other strict sites) set `form-action 'self'` in their
 * CSP, which blocks any form whose action is a different origin. CSP
 * does not restrict postMessage, and `window.open` to a different
 * origin is not subject to `form-action`, so the popup handoff slips
 * through cleanly. Once /clip has the data, it submits the form
 * same-origin where CSP is permissive.
 *
 * Why bookmarklet over extension:
 * - Zero install: drag a link, done. No store review, no permissions prompt.
 * - The `javascript:` URL itself is exempt from page CSP, so the inline
 *   code can run on sites with otherwise strict policies.
 *
 * The `__ORIGIN__` token is replaced at install time with the user's app
 * origin (e.g. http://localhost:3000); see buildBookmarklet().
 */
export const BOOKMARKLET_SOURCE = String.raw`(function(){
var APP_ORIGIN='__ORIGIN__';
function t(el){return el?(el.textContent||'').replace(/\s+/g,' ').trim():'';}
function pick(sels,root){root=root||document;for(var i=0;i<sels.length;i++){var el=root.querySelector(sels[i]);if(el)return el;}return null;}
function html(el){return el?el.outerHTML:'';}
function linkedIn(){
  var clickMore=pick(['.show-more-less-html__button--more','button.show-more-less-html__button']);
  if(clickMore){try{clickMore.click();}catch(e){}}
  return{
    site:'linkedin',
    title:t(pick(['.top-card-layout__title','.topcard__title','.job-details-jobs-unified-top-card__job-title','h1'])),
    company:t(pick(['.topcard__org-name-link','.topcard__flavor a','.job-details-jobs-unified-top-card__company-name a','.job-details-jobs-unified-top-card__company-name'])),
    location:t(pick(['.topcard__flavor--bullet','.job-details-jobs-unified-top-card__bullet','.topcard__flavor--metadata'])),
    remote:/remote/i.test(t(pick(['.topcard__flavor--workplace','.job-details-jobs-unified-top-card__workplace-type']))+' '+t(pick(['.topcard__flavor--bullet','.job-details-jobs-unified-top-card__bullet'])))?'1':'',
    descriptionHtml:html(pick(['.show-more-less-html__markup','.jobs-description__content .jobs-description-content__text','.jobs-description-content__text','.jobs-box__html-content','.description__text']))
  };
}
function indeed(){
  return{
    site:'indeed',
    title:t(pick(['h1[data-testid="jobsearch-JobInfoHeader-title"]','h1.jobsearch-JobInfoHeader-title','h1'])),
    company:t(pick(['[data-testid="inlineHeader-companyName"] a','[data-testid="inlineHeader-companyName"]','[data-company-name="true"]'])),
    location:t(pick(['[data-testid="inlineHeader-companyLocation"]','[data-testid="jobsearch-JobInfoHeader-companyLocation"]'])),
    descriptionHtml:html(pick(['#jobDescriptionText','.jobsearch-JobComponent-description']))
  };
}
function glassdoor(){
  return{
    site:'glassdoor',
    title:t(pick(['[data-test="job-title"]','h1'])),
    company:t(pick(['[data-test="employer-name"]','div[data-test="employer-name"] a'])),
    location:t(pick(['[data-test="location"]'])),
    descriptionHtml:html(pick(['[data-test="jobDescription"]','#JobDescriptionContainer','.JobDetails_jobDescription__uW_fK']))
  };
}
function generic(){
  return{
    site:'generic',
    title:t(pick(['h1','[itemprop="title"]'])),
    fullPageHtml:document.documentElement.outerHTML
  };
}
var host=location.hostname.toLowerCase();
var data;
if(/(^|\.)linkedin\.com$/.test(host))data=linkedIn();
else if(/(^|\.)indeed\.[a-z.]+$/.test(host))data=indeed();
else if(/(^|\.)glassdoor\.[a-z.]+$/.test(host))data=glassdoor();
else data=generic();
if(!data.fullPageHtml){
  data.fullPageHtml=document.documentElement.outerHTML;
}
data.url=location.href;
var popup=window.open(APP_ORIGIN+'/clip','_blank');
if(!popup){
  alert('Allow popups for this site to use the Next Job Spy importer.');
  return;
}
function send(){popup.postMessage({type:'njs-payload',data:data},APP_ORIGIN);}
var attempts=0;
var ticker=setInterval(function(){
  attempts++;
  send();
  if(attempts>40){clearInterval(ticker);}
},150);
function onMessage(e){
  if(e.origin!==APP_ORIGIN)return;
  if(e.data&&e.data.type==='njs-ack'){
    clearInterval(ticker);
    window.removeEventListener('message',onMessage);
  }
}
window.addEventListener('message',onMessage);
})();`;
