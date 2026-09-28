# Run from skills/concept-explorer/: python3 build_site.py  → writes ../../site/
import re
t=open('template/app-template.html').read()
t=t.replace("function setTopic(k, s, step){ tp = k; T = TOPICS[k];","function setTopic(k, s, step){ tp = k; T = TOPICS[k]; s = Math.min(s || 0, T.SCENARIOS.length - 1);")
def topic(tid, name, versions, files):
    body="\n".join(open(f).read() for f in files)
    import json
    return "TOPICS.push((function(){\n"+body+"\nreturn {id:"+json.dumps(tid)+", name:"+json.dumps(name,ensure_ascii=False)+", versions:"+json.dumps(versions,ensure_ascii=False)+", NODES:NODES, GROUPS:GROUPS, OWN:OWN, SECTIONS:SECTIONS, SCENARIOS:SCENARIOS};\n})());\n"
V='examples/spring-security/'; C='examples/spring-core/'
J='examples/journey/'
data=topic("journey","Full request journey (big picture)","One JVM, one thread: Tomcat 10.1 · Spring Security 6.5 · Spring MVC 6.2 · Spring Data JPA · Hibernate 6.6 · HikariCP (Spring Boot 3.5).",[J+'data.js'])
data+=topic("security","Spring Security","Spring Security 6.5 · Spring Authorization Server 1.5 · Spring Boot 3.5. Filters shown in their real default order (a few rarely used ones left out).",[V+'data.js',V+'own.js',V+'scenarios.js'])
data+=topic("core","Spring Core: beans, AOP, @Transactional","Java 17 · Spring Framework 6.2 · Spring Boot 3.5 · Hibernate 6.6.",[C+'data.js',C+'own.js',C+'scenarios.js'])
B='examples/boot/'
data+=topic("boot","Spring Boot internals","Spring Boot 3.5 · Spring Framework 6.2 · Tomcat 10.1 · Micrometer 1.15.",[B+'data.js',B+'scenarios.js'])
M='examples/mvc/'
data+=topic("mvc","Spring MVC internals","Spring Framework 6.2 (Spring MVC) · Spring Boot 3.5 · Jackson 2.19 · Tomcat 10.1.",[M+'data.js',M+'scenarios.js'])
P='examples/jpa/'
data+=topic("jpa","Spring Data JPA + Hibernate","Spring Data JPA 3.5 · Hibernate ORM 6.6 · Spring Boot 3.5 · HikariCP.",[P+'data.js',P+'scenarios.js'])
CL='examples/cloud/'
data+=topic("cloud","Spring Cloud (microservices)","Spring Cloud 2025.0 (for Boot 3.5) · Gateway 4.3 · OpenFeign 4.3 · LoadBalancer · Netflix Eureka · Config · CircuitBreaker + Resilience4j 2.x.",[CL+'data.js',CL+'scenarios.js'])
K='examples/kafka/'
data+=topic("kafka","Spring for Apache Kafka","Spring for Apache Kafka 3.3 · Kafka clients 3.9 · Spring Boot 3.5.",[K+'data.js',K+'scenarios.js'])
O='examples/obs/'
data+=topic("obs","Observability (metrics, tracing, logs)","Micrometer 1.15 · Micrometer Tracing 1.5 (OpenTelemetry/Brave) · Spring Boot 3.5 Actuator.",[O+'data.js',O+'scenarios.js'])
PWA_HEAD = ('<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#000000">\n'
  '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
  '<meta name="apple-mobile-web-app-title" content="Java Internals">\n')
PWA_SW = ('<script>if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost") && !/claude\\.ai$/.test(location.hostname)) '
  '{ navigator.serviceWorker.register("sw.js").catch(function(){}); }</script>\n')
page = t.replace('/*TOPICS*/', data).replace('<title>', PWA_HEAD + '<title>', 1).replace('</script>\n</body>', '</script>\n' + PWA_SW + '</body>') 
if PWA_SW not in page: page = page.rstrip() + '\n' + PWA_SW
open('../../site/index.html','w').write(page)
back='<p style="max-width:980px;margin:12px auto 0;padding:0 16px"><a href="index.html" style="color:#5cc8f0">← Java Internals explorer</a></p>\n'
for src,dst in [('../../tracker/security-in-pictures.html','../../site/pictures.html'),('../../tracker/authentication-poster.html','../../site/poster.html')]:
    s=open(src).read()
    s='<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n'+s
    s=re.sub(r'(</style>\s*)', r'\1'+back.replace('\\','\\\\'), s, count=1)
    open(dst,'w').write(s)
import subprocess, sys
for name in ('learn', 'dev', 'wire'):
    lp='../../site/%s.html' % name
    subprocess.run([sys.executable, 'learn/build_%s.py' % name, lp], check=True)
    L=open(lp).read()
    L=L.replace('<title>', PWA_HEAD + '<title>', 1).rstrip() + '\n' + PWA_SW
    open(lp,'w').write(L)
back = '<p style="margin:0 0 8px"><a href="index.html" style="color:#5cc8f0;text-decoration:none">← Java Internals explorer</a></p>\n'
for src, dst in [('learn/pages/sky.html', '../../site/sky.html'), ('learn/pages/decisions.html', '../../site/decisions.html'), ('learn/pages/compare.html', '../../site/compare.html')]:
    P = open(src).read()
    P = '<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' + P.replace('<title>', PWA_HEAD + '<title>', 1)
    P = P.replace('<div class="wrap">\n', '<div class="wrap">\n' + back, 1).rstrip() + '\n' + PWA_SW
    open(dst, 'w').write(P)
print("built")
