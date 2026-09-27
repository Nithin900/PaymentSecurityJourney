# Run from skills/concept-explorer/: python3 build_site.py  → writes ../../site/
import re
t=open('template/app-template.html').read()
t=t.replace("function setTopic(k, s, step){ tp = k; T = TOPICS[k];","function setTopic(k, s, step){ tp = k; T = TOPICS[k]; s = Math.min(s || 0, T.SCENARIOS.length - 1);")
def topic(tid, name, versions, files):
    body="\n".join(open(f).read() for f in files)
    return ("TOPICS.push((function(){\n"+body+"\nreturn {id:%r, name:%r, versions:%r, NODES:NODES, GROUPS:GROUPS, OWN:OWN, SECTIONS:SECTIONS, SCENARIOS:SCENARIOS};\n})());\n")%(tid,name,versions)
V='examples/spring-security/'; C='examples/spring-core/'
J='examples/journey/'
data=topic("journey","Full request journey (big picture)","One JVM, one thread: Tomcat 10.1 · Spring Security 6.5 · Spring MVC 6.2 · Spring Data JPA · Hibernate 6.6 · HikariCP (Spring Boot 3.5).",[J+'data.js'])
data+=topic("security","Spring Security","Spring Security 6.5 · Spring Authorization Server 1.5 · Spring Boot 3.5. Filters shown in their real default order (a few rarely used ones left out).",[V+'data.js',V+'own.js',V+'scenarios.js'])
data+=topic("core","Spring Core: beans, AOP, @Transactional","Java 17 · Spring Framework 6.2 · Spring Boot 3.5 · Hibernate 6.6.",[C+'data.js',C+'own.js',C+'scenarios.js'])
B='examples/boot/'
data+=topic("boot","Spring Boot internals","Spring Boot 3.5 · Spring Framework 6.2 · Tomcat 10.1 · Micrometer 1.15.",[B+'data.js',B+'scenarios.js'])
M='examples/mvc/'
data+=topic("mvc","Spring MVC internals","Spring Framework 6.2 (Spring MVC) · Spring Boot 3.5 · Jackson 2.19 · Tomcat 10.1.",[M+'data.js',M+'scenarios.js'])
open('../../site/index.html','w').write(t.replace('/*TOPICS*/',data))
back='<p style="max-width:980px;margin:12px auto 0;padding:0 16px"><a href="index.html" style="color:#5cc8f0">← Java Internals explorer</a></p>\n'
for src,dst in [('../../tracker/security-in-pictures.html','../../site/pictures.html'),('../../tracker/authentication-poster.html','../../site/poster.html')]:
    s=open(src).read()
    s='<!doctype html>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n'+s
    s=re.sub(r'(</style>\s*)', r'\1'+back.replace('\\','\\\\'), s, count=1)
    open(dst,'w').write(s)
print("built")
