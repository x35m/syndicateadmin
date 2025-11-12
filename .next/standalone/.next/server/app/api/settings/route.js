"use strict";(()=>{var t={};t.id=668,t.ids=[668],t.modules={399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5900:t=>{t.exports=require("pg")},5171:(t,e,a)=>{a.r(e),a.d(e,{originalPathname:()=>y,patchFetch:()=>_,requestAsyncStorage:()=>g,routeModule:()=>d,serverHooks:()=>c,staticGenerationAsyncStorage:()=>l});var n={};a.r(n),a.d(n,{GET:()=>m,POST:()=>u});var i=a(9303),s=a(8716),o=a(670),r=a(7070),p=a(9487);async function m(){try{let t=await p.db.getSetting("gemini_api_key"),e=await p.db.getSetting("claude_api_key"),a=await p.db.getSetting("ai_provider")||"gemini",n=await p.db.getSetting("gemini_model")||"gemini-2.5-flash",i=await p.db.getSetting("claude_model")||"claude-3-5-sonnet-20240620",s=await p.db.getSetting("analysis_prompt"),o=await p.db.getSetting("summary_prompt"),m=await p.db.getSetting("taxonomy_system_prompt"),u=await p.db.getSetting("taxonomy_format_prompt"),d=`Ты - аналитик новостного контента. Проанализируй статью и предоставь структурированный результат.

ЗАДАЧИ:

1. META_DESCRIPTION (150-160 символов):
   - Краткое описание сути статьи для SEO
   - Нейтральный тон, максимально информативно
   - Для поисковых систем и социальных сетей

2. SUMMARY (3-5 предложений):
   - Выдели основные моменты и ключевые идеи
   - Профессиональный аналитический стиль
   - Полностью нейтральное изложение без эмоциональной окраски
   - Простой человеческий язык для комфортного восприятия
   - ВАЖНО: Перефразируй своими словами, НЕ копируй предложения из оригинала
   - SEO уникальность 90%+

3. SENTIMENT (тональность материала):
   - positive (позитивная)
   - neutral (нейтральная)
   - negative (негативная)

4. CONTENT_TYPE (тип контента):
   - purely_factual (новостная заметка, только факты)
   - mostly_factual (преимущественно факты с элементами анализа)
   - balanced (факты и мнения примерно поровну)
   - mostly_opinion (аналитика с мнениями)
   - purely_opinion (авторская колонка, редакционная статья)

5. TAXONOMY (классификация):
   - Определи страны и города, связанные с материалом

Ответ должен быть на русском языке в формате JSON с полями: meta_description, summary, sentiment, content_type, taxonomy.`;return r.NextResponse.json({success:!0,data:{geminiApiKey:t||"",claudeApiKey:e||"",aiProvider:a||"gemini",geminiModel:n||"gemini-2.5-flash",claudeModel:i||"claude-3-5-sonnet-20240620",analysisPrompt:s||d,summaryPrompt:o||"Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).",taxonomySystemPrompt:m||"Ты — редактор аналитического портала. Определи страну и города статьи так, чтобы они помогали редакции быстро рубрицировать материалы.",taxonomyFormatPrompt:u||'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "country": "Название страны или null",\n    "city": "Название города или null"\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null.'}})}catch(t){return console.error("Error fetching settings:",t),r.NextResponse.json({success:!1,error:"Failed to fetch settings"},{status:500})}}async function u(t){try{let{geminiApiKey:e,claudeApiKey:a,aiProvider:n,geminiModel:i,claudeModel:s,analysisPrompt:o,summaryPrompt:m,taxonomySystemPrompt:u,taxonomyFormatPrompt:d}=await t.json();if(!("claude"===n?a:e))return r.NextResponse.json({success:!1,error:"API ключ обязателен"},{status:400});return await p.db.setSetting("gemini_api_key",e||""),await p.db.setSetting("gemini_model",i||"gemini-2.5-flash"),await p.db.setSetting("claude_api_key",a||""),await p.db.setSetting("claude_model",s||"claude-3-5-sonnet-20240620"),await p.db.setSetting("ai_provider",n||"gemini"),o&&await p.db.setSetting("analysis_prompt",o),m&&await p.db.setSetting("summary_prompt",m),u&&await p.db.setSetting("taxonomy_system_prompt",u),d&&await p.db.setSetting("taxonomy_format_prompt",d),r.NextResponse.json({success:!0,message:"Settings saved successfully"})}catch(t){return console.error("Error saving settings:",t),r.NextResponse.json({success:!1,error:"Failed to save settings"},{status:500})}}let d=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/settings/route",pathname:"/api/settings",filename:"route",bundlePath:"app/api/settings/route"},resolvedPagePath:"/Users/macbookpro/Desktop/syndicateadmin/app/api/settings/route.ts",nextConfigOutput:"standalone",userland:n}),{requestAsyncStorage:g,staticGenerationAsyncStorage:l,serverHooks:c}=d,y="/api/settings/route";function _(){return(0,o.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:l})}}};var e=require("../../../webpack-runtime.js");e.C(t);var a=t=>e(e.s=t),n=e.X(0,[948,972,487],()=>a(5171));module.exports=n})();