@include "./discord_elements.ne"
all_commands ->  (say | setanonchannel | pin | listanonchannels | whosaid | reminder | clonepurge | deletechannel | channeluser | archivechannel | anonban | alpha | anonunban | tmpchannel | setpinperms | listpinperms | autoresponder | starboard | star | reactionroles | kick | tmprole
| purge | setupmute | mute | unmute | usercard | note | forgive | invite | userpic | ping | alertchannel | cat | joinroles | eval | about | lockdown | 
unlockdown | poll | color | automod | slowmode | suggestion | prefix | embed | addemoji | support | ticket | announce | spoil | pick | owo | disablecommand |
enablecommand | pfp | logging | admin | setchannelname | setservername | waitforupdate | ban | removeemoji
) {% n => n[0] %}
pin -> "pin"i __ anything {% n => {return {command: "pin", text: n[2]}} %}
say ->  "say"i __ (channel __):? ("remove" | "keep") __ anything {% n => {return {command: "say", text: n[5], channel: n[2] ? n[2][0] : null, keep: n[3][0]  == "keep"}} %}
setanonchannel -> "setanonchannel"i __ ("enabled" | "disabled") (__ channel):? {% n => {return {command: "setanonchannel", enabled: n[2][0] == "enabled", channel: n[3] ? n[3][1] : null}} %}
listanonchannels -> "listanonchannels"i {% ()=>{return {command: "listanonchannels"}}%}
whosaid -> "whosaid"i __ anything {% (n)=>{return {command: "whosaid", id: n[2]}}%}
reminder -> ("reminder"i | "rm"i | "reminders"i) __ (("add" __ word __ anything) | ("list") | ("cancel" __ word) | ("copy" __ word) ) {% (n)=>{return {command: "reminder", time: n[2][0][0] == "add" ? n[2][0][2] : undefined, text: n[2][0][0] == "add" ? n[2][0][4] : undefined, action: n[2][0][0], id: n[2][0][0] == "cancel" || n[2][0][0] == "copy" ? n[2][0][2] : undefined}}%}
clonepurge -> "clonepurge"i {% ()=>{return {command: "clonepurge"}}%}
deletechannel -> "deletechannel"i {% ()=>{return {command: "deletechannel"}}%}
channeluser -> "channeluser"i __ ("add" | "remove") __ user (__ channel):? {% (n)=>{return {command: "channeluser", allowed: n[2][0]=="add", user: n[4], channel:n[5] ? n[5][1] : null}}%}
archivechannel -> "archivechannel"i __ role {% (n)=>{return {command: "archivechannel", role: n[2]}}%}
anonban -> "anonban"i __ user (__ word):? {% (n)=>{return {command: "anonban", user: n[2], time: n[3] ? n[3][1] : null}}%}
anonunban -> "anonunban"i __ user {% (n)=>{return {command: "anonunban", user: n[2]}}%}
setpinperms -> "setpinperms"i __ ("allowed" | "disallowed") __ role {% (n)=>{return {command: "setpinperms", allowed:n[2][0]=="allowed", role: n[4]}}%}
listpinperms -> "listpinperms"i {% (n)=>{return {command: "listpinperms"}}%}
tmpchannel -> "tmpchannel"i __ word __ word __ ("private" | "public") {% (n)=>{return {command: "tmpchannel", name: n[2], duration: n[4], public: n[6][0] == "public"}}%}
autoresponder -> ("autoresponder"i | "autoresponders"i | "ar"i | "trigger"i | "triggers"i) __ ("add" | "remove" | "list") {% (n)=>{return {command: "autoresponder", action: n[2][0]}}%}
starboard -> "starboard"i __ ("enable" | "disable" | "configure" | "fixperms") {% (n)=>{return {command: "starboard", action: n[2][0]}}%}
star -> "star"i __ ("random") {% (n)=>{return {command: "star", action: n[2][0]}}%}
alpha -> ("alpha"i | "a"i) __ anything {% n => {return {command: "alpha", text: n[2]}} %}
reactionroles -> ("reactionroles"i | "rr"i) __ ("add" | "edit") {% (n)=>{return {command: "reactionroles", action: n[2][0]}}%}
kick -> "kick"i __ user {% (n)=>{return {command: "kick", user: n[2]}}%}
ban -> "ban"i __ user {% (n)=>{return {command: "ban", user: n[2]}}%}
tmprole -> "tmprole"i __ ("add" | "remove") __ user __ role __ word {% (n)=>{return {command: "tmprole", user: n[4], role: n[6], duration: n[8], action:n[2][0]}}%}
purge -> "purge"i __ number {% (n)=>{return {command: "purge", count: n[2]}}%}
setupmute -> "setupmute"i {% (n)=>{return {command: "setupmute"}}%}
mute -> "mute"i __ user (__ word (__ anything):?):? {% (n)=>{return {command: "mute", user: n[2], duration: n[3] ? n[3][1] : null}}%}
unmute -> "unmute"i __ user {% (n)=>{return {command: "unmute", user: n[2]}}%}
usercard -> "usercard"i __ user {% (n)=>{return {command: "usercard", user: n[2]}}%}
note -> ("warn"i | "note"i) __ user __ anything {% (n)=>{return {command: n[0][0].toLowerCase(), user: n[2], text: n[4]}}%}
forgive -> ("forgive"i | "forgivewarn"i | "removewarn"i | "unwarn"i | "pardon"i) __ word {% (n)=>{return {command: "forgive", id: n[2]}}%}
invite -> "invite"i {% (n)=>{return {command: "invite"}}%}
userpic -> "userpic"i {% (n)=>{return {command: "userpic"}}%}
ping -> "ping"i {% (n)=>{return {command: "ping"}}%}
alertchannel -> "alertchannel"i __ ("enable" | "disable" | "ignore") {% (n)=>{return {command: "alertchannel", action: n[2][0]}}%}
joinroles -> "joinroles"i __ ("enable" | "disable") {% (n)=>{return {command: "joinroles", action: n[2][0]}}%}
eval -> "eval"i __ anything {% (n)=>{return {command: "eval", code: n[2]}}%}
cat -> "cat"i {% (n)=>{return {command: "cat"}}%}
about -> "about"i {% (n)=>{return {command: "about"}}%}
lockdown -> "lockdown"i (__ word):? {% (n)=>{return {command: "lockdown", time: n[1] ? n[1][1] : null}}%}
unlockdown -> "unlockdown"i __ channel {% (n)=>{return {command: "unlockdown", channel: n[2]}}%}
poll -> "poll"i __ anything {% n => {return {command: "poll", text: n[2]}} %}
color -> ("color"i | "colour"i) __ anything {% n => {return {command: "color", color: n[2]}} %}
automod -> "automod"i __ ("enable" | "disable" | "list" | "add" | "remove" | "inspect") {% (n)=>{return {command: "automod", action: n[2][0]}}%}
slowmode -> "slowmode"i __ ("enable" | "disable") __ channel {% (n)=>{return {command: "slowmode", action: n[2][0], channel: n[4]}}%}
suggestion -> ("suggestion"i | "suggest"i) {% (n)=>{return {command: "suggestion"}}%}
prefix -> "prefix"i __ ("list" | "add" | "remove") {% (n)=>{return {command: "prefix", action: n[2][0]}}%}
embed -> "embed"i __ ("create" | "edit") {% (n)=>{return {command: "embed", action: n[2][0]}}%}
addemoji -> "addemoji"i __  word (__ word):? {% (n)=>{return {command: "addemoji", name: n[2], emojiData: n[3] ? n[3][1]: undefined}}%}
support -> "support"i {% (n)=>{return {command: "support"}}%}
ticket -> "ticket"i __ (("create" __ role __ user) | ("delete")) {% (n)=>{return {command: "ticket", user: n[2][0][0] == "create" ? n[2][0][4] : undefined, role: n[2][0][0] == "create" ? n[2][0][2] : undefined, action: n[2][0][0]}} %}
announce -> "announce"i {% (n)=>{return {command: "announce"}}%}
spoil -> "spoil"i (__ anything):? {% n => {return {command: "spoil", text: n[1] ? n[1][1] : ""}} %}
pick -> "pick"i __ anything {% n => {return {command: "pick", text: n[2]}} %}
owo -> "owo"i __ word (__ user):? {% (n)=>{return {command: "owo", action: n[2], authee: n[3] ? n[3][1] : undefined}}%}
disablecommand -> "disablecommand"i __ word {% (n)=>{return {command: "disablecommand", text: n[2]}}%}
enablecommand -> "enablecommand"i __ word {% (n)=>{return {command: "enablecommand", text: n[2]}}%}
pfp -> "pfp"i __ user {% (n)=>{return {command: "pfp", user: n[2]}}%}
logging -> "logging"i __ ("enable" | "disable") {% (n)=>{return {command: "logging", action: n[2][0]}}%}
admin -> "admin"i {% (n)=>{return {command: "admin"}}%}
setchannelname -> "setchannelname"i __ anything {% (n)=>{return {command: "setchannelname", name: n[2]}}%}
setservername -> "setservername"i __ anything {% (n)=>{return {command: "setservername", name: n[2]}}%}
waitforupdate -> "waitforupdate"i {% (n)=>{return {command: "waitforupdate", name: n[2]}}%}
removeemoji -> "removeemoji"i __ word {% (n)=>{return {command: "removeemoji", name: n[2]}}%}