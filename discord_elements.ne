# Match a CSS color
# http://www.w3.org/TR/css3-color/#colorunits
@builtin "whitespace.ne" # `_` means arbitrary amount of whitespace
@builtin "number.ne"     # `int`, `decimal`, and `percentage` number primitives
anything -> [\S\s]:+ {% n=> n[0].join('') %}
word -> [\S]:+ {% n=> n[0].join('') %}
channel -> "<#":? number ">":? {% (x)=>x[1] %}
role -> "<@&":? number ">":? {% (x)=>x[1] %}
user -> "<@":? "<@!":? number ">":? {% (x)=>x[2] %}
number -> [0-9]:+ {% n=> n[0].join('') %}
prefix -> "m:" 
__  -> wschar {% function(d) {return null;} %}