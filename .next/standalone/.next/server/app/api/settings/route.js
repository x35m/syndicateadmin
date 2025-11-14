"use strict";(()=>{var t={};t.id=6668,t.ids=[6668],t.modules={399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},5900:t=>{t.exports=require("pg")},5171:(t,e,a)=>{a.r(e),a.d(e,{originalPathname:()=>_,patchFetch:()=>S,requestAsyncStorage:()=>l,routeModule:()=>g,serverHooks:()=>y,staticGenerationAsyncStorage:()=>c});var i={};a.r(i),a.d(i,{GET:()=>d,POST:()=>m});var s=a(9303),n=a(8716),o=a(670),r=a(7070),p=a(9487),u=a(7435);async function d(){try{let t=await p.db.getSetting("gemini_api_key"),e=await p.db.getSetting("claude_api_key"),a=await p.db.getSetting("ai_provider")||"gemini",i=await p.db.getSetting("gemini_model")||"gemini-2.5-flash",s=await p.db.getSetting("claude_model")||"claude-sonnet-4-20250514",n=await p.db.getSetting("analysis_prompt"),o=await p.db.getSetting("summary_prompt"),u=await p.db.getSetting("taxonomy_system_prompt"),d=await p.db.getSetting("taxonomy_format_prompt"),m=`Ты - аналитик новостного контента. Проанализируй статьи, создай качественные саммари и оцени характеристики материала.

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
   - Определи подходящие категории, а также страны и города, связанные с материалом

ПРИНЦИПЫ:
- Пиши напрямую, не ссылайся на статью (\xabВ материале говорится…\xbb)
- Максимально информативно и нейтрально
- Избегай клише и оценочных суждений`;return r.NextResponse.json({success:!0,data:{geminiApiKey:t||"",claudeApiKey:e||"",aiProvider:a||"gemini",geminiModel:i||"gemini-2.5-flash",claudeModel:s||"claude-sonnet-4-20250514",analysisPrompt:n||m,summaryPrompt:o||"Создай краткое саммари следующей статьи. Выдели основные моменты и ключевые идеи. Ответ должен быть на русском языке, лаконичным и информативным (3-5 предложений).",taxonomySystemPrompt:u||"Ты — редактор аналитического портала. Определи подходящие категории, а также страну и города статьи так, чтобы они помогали редакции быстро рубрицировать материалы.",taxonomyFormatPrompt:d||'Верни ответ строго в формате JSON:\n{\n  "summary": "краткое резюме на русском",\n  "taxonomy": {\n    "categories": ["Название категории"],\n    "country": "Название страны или null",\n    "city": "Название города или null"\n  }\n}\nНе добавляй пояснений. Если не удалось определить значение, используй null.'}})}catch(t){return console.error("Error fetching settings:",t),await (0,u.r)("api/settings",t,{method:"GET"}),r.NextResponse.json({success:!1,error:"Failed to fetch settings"},{status:500})}}async function m(t){try{let{geminiApiKey:e,claudeApiKey:a,aiProvider:i,geminiModel:s,claudeModel:n,analysisPrompt:o,summaryPrompt:u,taxonomySystemPrompt:d,taxonomyFormatPrompt:m}=await t.json();if(!("claude"===i?a:e))return r.NextResponse.json({success:!1,error:"API ключ обязателен"},{status:400});return await p.db.setSetting("gemini_api_key",e||""),await p.db.setSetting("gemini_model",s||"gemini-2.5-flash"),await p.db.setSetting("claude_api_key",a||""),await p.db.setSetting("claude_model",n||"claude-sonnet-4-20250514"),await p.db.setSetting("ai_provider",i||"gemini"),o&&await p.db.setSetting("analysis_prompt",o),u&&await p.db.setSetting("summary_prompt",u),d&&await p.db.setSetting("taxonomy_system_prompt",d),m&&await p.db.setSetting("taxonomy_format_prompt",m),r.NextResponse.json({success:!0,message:"Settings saved successfully"})}catch(t){return console.error("Error saving settings:",t),await (0,u.r)("api/settings",t,{method:"POST"}),r.NextResponse.json({success:!1,error:"Failed to save settings"},{status:500})}}let g=new s.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/settings/route",pathname:"/api/settings",filename:"route",bundlePath:"app/api/settings/route"},resolvedPagePath:"/Users/macbookpro/Desktop/syndicateadmin/app/api/settings/route.ts",nextConfigOutput:"standalone",userland:i}),{requestAsyncStorage:l,staticGenerationAsyncStorage:c,serverHooks:y}=g,_="/api/settings/route";function S(){return(0,o.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:c})}}};var e=require("../../../webpack-runtime.js");e.C(t);var a=t=>e(e.s=t),i=e.X(0,[8948,5972,7435],()=>a(5171));module.exports=i})();