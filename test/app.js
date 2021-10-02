
function billboard(name, price = 30){
    console.log([...name].length * 30)
}

/*function tytytyt () {
    return "sdfsdf"
}*/

function toAlternatingCase () {
    console.log("ddd")
}

Object.prototype.toAlternatingCase = function(){
    console.log(this.toLowerCase());
};

const onesCounter = (input) => {
    return input
}


console.log(onesCounter([1, 1, 1, 0, 0, 1, 0, 1, 1, 0]))