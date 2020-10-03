@include "./discord_elements.ne"
all_commands ->  (say | setanonchannel | pin | listanonchannels | whosaid | reminder | clonepurge | deletechannel | channeluser | archivechannel | anonban | alpha | anonunban | tmpchannel | setpinperms | listpinperms | autoresponder | starboard | star | reactionroles | kick | tmprole
| purge | setupmute | mute | unmute | usercard | note | forgive | invite | userpic | ping | alertchannel | cat | joinroles | eval | about | lockdown | 
unlockdown | poll | color | automod | slowmode | suggestion | prefix | embed | addemoji | support | ticket | announce
) {% n => n[0] %}
pin -> "pin" __ anything {% n => {return {command: "pin", text: n[2]}} %}
say ->  "say" __ (channel __):? ("remove" | "keep") __ anything {% n => {return {command: "say", text: n[5], channel: n[2] ? n[2][0] : null, keep: n[3][0]  == "keep"}} %}
setanonchannel -> "setanonchannel" __ ("enabled" | "disabled") (__ channel):? {% n => {return {command: "setanonchannel", enabled: n[2][0] == "enabled", channel: n[3] ? n[3][1] : null}} %}
listanonchannels -> "listanonchannels" {% ()=>{return {command: "listanonchannels"}}%}
whosaid -> "whosaid" __ anything {% (n)=>{return {command: "whosaid", id: n[2]}}%}
reminder -> "reminder" __ (("add" __ word __ anything) | ("cancel" __ word) | ("copy" __ word) ) {% (n)=>{return {command: "reminder", time: n[2][0][0] == "add" ? n[2][0][2] : undefined, text: n[2][0][0] == "add" ? n[2][0][4] : undefined, action: n[2][0][0], id: n[2][0][0] == "cancel" || n[2][0][0] == "copy" ? n[2][0][2] : undefined}}%}
clonepurge -> "clonepurge" {% ()=>{return {command: "clonepurge"}}%}
deletechannel -> "deletechannel" {% ()=>{return {command: "deletechannel"}}%}
channeluser -> "channeluser" __ ("add" | "remove") __ user (__ channel):? {% (n)=>{return {command: "channeluser", allowed: n[2][0]=="add", user: n[4], channel:n[5] ? n[5][1] : null}}%}
archivechannel -> "archivechannel" __ role {% (n)=>{return {command: "archivechannel", role: n[2]}}%}
anonban -> "anonban" __ user (__ word):? {% (n)=>{return {command: "anonban", user: n[2], time: n[3] ? n[3][1] : null}}%}
anonunban -> "anonunban" __ user {% (n)=>{return {command: "anonunban", user: n[2]}}%}
setpinperms -> "setpinperms" __ ("allowed" | "disallowed") __ role {% (n)=>{return {command: "setpinperms", allowed:n[2][0]=="allowed", role: n[4]}}%}
listpinperms -> "listpinperms" {% (n)=>{return {command: "listpinperms"}}%}
tmpchannel -> "tmpchannel" __ word __ word __ ("private" | "public") {% (n)=>{return {command: "tmpchannel", name: n[2], duration: n[4], public: n[6][0] == "public"}}%}
autoresponder -> "autoresponder" __ ("add" | "remove" | "list") {% (n)=>{return {command: "autoresponder", action: n[2][0]}}%}
starboard -> "starboard" __ ("enable" | "disable" | "configure" | "fixperms") {% (n)=>{return {command: "starboard", action: n[2][0]}}%}
star -> "star" __ ("random") {% (n)=>{return {command: "star", action: n[2][0]}}%}
alpha -> "alpha" __ anything {% n => {return {command: "alpha", text: n[2]}} %}
reactionroles -> "reactionroles" __ ("add" | "edit") {% (n)=>{return {command: "reactionroles", action: n[2][0]}}%}
kick -> "kick" __ user {% (n)=>{return {command: "kick", user: n[2]}}%}
tmprole -> "tmprole" __ ("add" | "remove") __ user __ role __ word {% (n)=>{return {command: "tmprole", user: n[4], role: n[6], duration: n[8], action:n[2][0]}}%}
purge -> "purge" __ number {% (n)=>{return {command: "purge", count: n[2]}}%}
setupmute -> "setupmute" {% (n)=>{return {command: "setupmute"}}%}
mute -> "mute" __ user (__ word (__ anything):?):? {% (n)=>{return {command: "mute", user: n[2], duration: n[3] ? n[3][1] : null}}%}
unmute -> "unmute" __ user {% (n)=>{return {command: "unmute", user: n[2]}}%}
usercard -> "usercard" __ user {% (n)=>{return {command: "usercard", user: n[2]}}%}
note -> ("warn" | "note") __ user __ anything {% (n)=>{return {command: n[0][0], user: n[2], text: n[4]}}%}
forgive -> "forgive" __ word {% (n)=>{return {command: "forgive", id: n[2]}}%}
invite -> "invite" {% (n)=>{return {command: "invite"}}%}
userpic -> "userpic" {% (n)=>{return {command: "userpic"}}%}
ping -> "ping" {% (n)=>{return {command: "ping"}}%}
alertchannel -> "alertchannel" __ ("enable" | "disable" | "ignore") {% (n)=>{return {command: "alertchannel", action: n[2][0]}}%}
joinroles -> "joinroles" __ ("enable" | "disable") {% (n)=>{return {command: "joinroles", action: n[2][0]}}%}
eval -> "eval" __ anything {% (n)=>{return {command: "eval", code: n[2]}}%}
cat -> "cat" {% (n)=>{return {command: "cat"}}%}
about -> "about" {% (n)=>{return {command: "about"}}%}
lockdown -> "lockdown" (__ word):? {% (n)=>{return {command: "lockdown", time: n[1] ? n[1][1] : null}}%}
unlockdown -> "unlockdown" __ channel {% (n)=>{return {command: "unlockdown", channel: n[2]}}%}
poll -> "poll" __ anything {% n => {return {command: "poll", text: n[2]}} %}
color -> "color" __ anything {% n => {return {command: "color", color: n[2]}} %}
automod -> "automod" __ ("enable" | "disable" | "list" | "add" | "remove" | "inspect") {% (n)=>{return {command: "automod", action: n[2][0]}}%}
slowmode -> "slowmode" __ ("enable" | "disable") __ channel {% (n)=>{return {command: "slowmode", action: n[2][0], channel: n[4]}}%}
suggestion -> "suggestion" {% (n)=>{return {command: "suggestion"}}%}
prefix -> "prefix" __ ("list" | "add" | "remove") {% (n)=>{return {command: "prefix", action: n[2][0]}}%}
embed -> "embed" __ ("create" | "edit") {% (n)=>{return {command: "embed", action: n[2][0]}}%}
addemoji -> "addemoji" __  word (__ word):? {% (n)=>{return {command: "addemoji", name: n[2], emojiData: n[3] ? n[3][1]: undefined}}%}
support -> "support" {% (n)=>{return {command: "support"}}%}
ticket -> "ticket" __ (("create" __ role __ user) | ("delete")) {% (n)=>{return {command: "ticket", user: n[2][0][0] == "create" ? n[2][0][4] : undefined, role: n[2][0][0] == "create" ? n[2][0][2] : undefined, action: n[2][0][0]}} %}
announce -> "announce" {% (n)=>{return {command: "announce"}}%}