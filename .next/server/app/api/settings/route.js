"use strict";(()=>{var e={};e.id=668,e.ids=[668],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5900:e=>{e.exports=require("pg")},5171:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>y,patchFetch:()=>_,requestAsyncStorage:()=>g,routeModule:()=>m,serverHooks:()=>c,staticGenerationAsyncStorage:()=>l});var i={};a.r(i),a.d(i,{GET:()=>u,POST:()=>d});var n=a(9303),s=a(8716),o=a(670),r=a(7070),p=a(9487);async function u(){try{let e=await p.db.getSetting("gemini_api_key"),t=await p.db.getSetting("claude_api_key"),a=await p.db.getSetting("ai_provider")||"gemini",i=await p.db.getSetting("gemini_model")||"gemini-2.5-flash",n=await p.db.getSetting("claude_model")||"claude-3-5-sonnet-20240620",s=await p.db.getSetting("analysis_prompt"),o=await p.db.getSetting("summary_prompt"),u=await p.db.getSetting("taxonomy_system_prompt"),d=await p.db.getSetting("taxonomy_format_prompt"),m=`Ты - аналитик новостного контента. Проанализируй статьи, создай качественные саммари и оцени характеристики материала.

ЗАДАЧИ:

1. META_DESCRIPTION (150-160 символов):
   - Краткое описание сути статьи для SEO
   - Нейтральный тон, максимально информативно
   - Для поисковых систем и социальных сетей

2. SUMMARY (3-5 предложений):
   - Выдели основные факты и ключевые идеи
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

ПРИНЦИПЫ:
- Пиши напрямую, не ссылайся на статью (\xabВ материале говорится…\xbb)
- Максимально информативно и нейтрально
- Избегай клише и оценочных суждений`;return r.NextResponse.json({success:!0,data:{geminiApiKey:e||"",claudeApiKey:t||"",aiProvider:a||"gemini",geminiModel:i||"gemini-2.5-flash",claudeModel:n||"claude-3-5-sonnet-20240620",analysisPrompt:s||m,summaryPrompt:o||"Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).",taxonomySystemPrompt:u||"Ты — редактор аналитического портала. Определи страну и города статьи так, чтобы они помогали редакции быстро рубрицировать материалы.",taxonomyFormatPrompt:d||'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "country": "Название страны или null",\n    "city": "Название города или null"\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null.'}})}catch(e){return console.error("Error fetching settings:",e),r.NextResponse.json({success:!1,error:"Failed to fetch settings"},{status:500})}}async function d(e){try{let{geminiApiKey:t,claudeApiKey:a,aiProvider:i,geminiModel:n,claudeModel:s,analysisPrompt:o,summaryPrompt:u,taxonomySystemPrompt:d,taxonomyFormatPrompt:m}=await e.json();if(!("claude"===i?a:t))return r.NextResponse.json({success:!1,error:"API ключ обязателен"},{status:400});return await p.db.setSetting("gemini_api_key",t||""),await p.db.setSetting("gemini_model",n||"gemini-2.5-flash"),await p.db.setSetting("claude_api_key",a||""),await p.db.setSetting("claude_model",s||"claude-3-5-sonnet-20240620"),await p.db.setSetting("ai_provider",i||"gemini"),o&&await p.db.setSetting("analysis_prompt",o),u&&await p.db.setSetting("summary_prompt",u),d&&await p.db.setSetting("taxonomy_system_prompt",d),m&&await p.db.setSetting("taxonomy_format_prompt",m),r.NextResponse.json({success:!0,message:"Settings saved successfully"})}catch(e){return console.error("Error saving settings:",e),r.NextResponse.json({success:!1,error:"Failed to save settings"},{status:500})}}let m=new n.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/settings/route",pathname:"/api/settings",filename:"route",bundlePath:"app/api/settings/route"},resolvedPagePath:"/Users/macbookpro/Desktop/syndicateadmin/app/api/settings/route.ts",nextConfigOutput:"standalone",userland:i}),{requestAsyncStorage:g,staticGenerationAsyncStorage:l,serverHooks:c}=m,y="/api/settings/route";function _(){return(0,o.patchFetch)({serverHooks:c,staticGenerationAsyncStorage:l})}}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[948,972,487],()=>a(5171));module.exports=i})();