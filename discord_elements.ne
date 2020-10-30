# Match a CSS color
# http://www.w3.org/TR/css3-color/#colorunits
@builtin "whitespace.ne" # `_` means arbitrary amount of whitespace
@builtin "number.ne"     # `int`, `decimal`, and `percentage` number primitives
anything -> [\S\s]:+ {% n=> n[0].join('') %}
word -> [\S]:+ {% n=> n[0].join('') %}
idchannel -> "<#":? number ">":? {% (x)=>{return {type: "channel_id", id: x[1]}} %}
namechannel -> word {% (x)=>{return {type: "channel_name", name: x[0]}} %}
channel -> (idchannel | namechannel) {% (x)=>x[0][0] %}
emote -> "<:" word ":" number ">":? {% (x)=>x[3] %}
role -> (idrole | namerole) {% (x)=>x[0][0] %}
idrole -> "<@&":? number ">":? {% (x)=>{return {type: "role_id", id: x[1]}} %}
namerole -> word {% (x)=>{return {type: "role_name", name: x[0]}} %}
user -> "<@":? "<@!":? number ">":? {% (x)=>x[2] %}
number -> [0-9]:+ {% n=> n[0].join('') %}
prefix -> "m:" 
__  -> wschar {% function(d) {return null;} %}