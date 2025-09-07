/* Another result of playing with curves to create an artistically interesting animation 
 * -------------------------------------------------------------------------------------- 
 * @date:      13th July, 2020  
 */  
//The curve
class Curve
{
    constructor(data)
    {          
        this.screenHeight = data.screenHeight;  
        this.screenWidth = data.screenWidth;      
        this.param  = 0;//the parameter in the parametric equation 
        this.xCoord = data.xCoord;//set x coordinate of the center of the curve  
        this.yCoord = data.yCoord;//set y coordinate of the center of the curve      
        this.color =  data.color; 
        //so the angle will increase from min to max and then vice versa
        this.maxAngle = 1; 
        this.minAngle = 0; 
        this.angle = this.minAngle;
        this.angleIncrement = 0.002; 
        this.toggleAngle = true;//true to move the angle from min to max, false for the reverse 
        //so the height will increase from min to max and vice versa 
        this.maxHeight = data.maxHeight; 
        this.minHeight = Math.min(20,this.maxHeight) === this.maxHeight? 10: 20; 
        this.height = this.minHeight; 
        this.toggleHeight = true;//true to move the height from min to max, false for the reverse   
    }  
    update() 
    { 
        //increases and reduces the angle, creating the effect of a rotating curve 
        if(this.toggleAngle)
        {
            this.angle+= this.angleIncrement; 
            //ensure angle never goes above the max
            if(this.angle >= this.maxAngle)
            { 
                this.toggleAngle = !this.toggleAngle;
            }
        }
        else 
        {
            this.angle-= this.angleIncrement; 
            //ensure angle never goes below the min
            if(this.angle <= this.minAngle)
            { 
                this.toggleAngle = !this.toggleAngle;
            }
        } 
        
        //increases and reduces the height
        if(this.toggleHeight)
        {
            this.height+= 1; 
            //ensure height never goes above the max
            if(this.height >= this.maxHeight)
            { 
              this.toggleHeight = !this.toggleHeight;
            }
        }
        else 
        {
            this.height-= 1; 
            //ensure height never goes below the min
            if(this.height <= this.minHeight)
            { 
                this.toggleHeight = !this.toggleHeight;
            }
        }
    } 
    draw()//draws the curve
    {        
        let coordinates = []; 
        this.param = 0;//reset parameter   
        //iterate the parameter from 0 to 12 * PI 
        for(this.param = 0; this.param <  12 * PI;this.param+= 0.007) 
        {     
            let x = 50* cos(this.param) * (( exp(cos(this.param ))) - (2 * cos(4 * this.param * this.angle)) + (pow(sin(this.param / 12), 5))) + this.xCoord;
            let y = this.height * sin(this.param) * ((exp(cos(this.param ))) - (2 * cos(4 * this.param * this.angle)) + (pow(sin(this.param / 12), 5))) + this.yCoord;        
            coordinates.push({x:x,y:y});    
        }   
        this.drawLines(coordinates);   
    }  
    drawLines(coordinates)//draw lines to connect the dots on the curve
    {
        stroke(this.color);
        strokeWeight(0.1); 
        for(let i = 0; i < coordinates.length; i++)
        {
            let point1 = coordinates[i];
            let point2 = coordinates[coordinates.length-1-i];
            let point3 = coordinates[coordinates.length-2-i];
            line(point1.x,point1.y,point2.x,point2.y); 
            line(point1.x,point1.y,point3.x,point3.y); 
            if(i >= coordinates.length/2)
            {
                break; 
            }
        }
    } 
    resize(screenWidth,screenHeight)
    {   
        if(this.screenHeight !== screenHeight || this.screenWidth !== screenWidth)//if the screen size has changed
        {    
            let dy = screenHeight/this.screenHeight;//percentage change in browser window height 
            let dx = screenWidth/this.screenWidth;//percentage change in browser window width  
            this.screenHeight = screenHeight;  
            this.screenWidth = screenWidth; 
            this.xCoord *= dx; 
            this.yCoord *= dy;   
            this.maxHeight *= dy;    
            this.minHeight *= dy;   
        } 
    }  
}

//Set everything up
let 
curve,
backgroundColor = 'rgba(0,0,0,1)';//black
function getBrowserWindowSize()//get the width and height of the browser window 
{
    let win = window,
    doc = document,
    offset = 20,//
    docElem = doc.documentElement,
    body = doc.getElementsByTagName('body')[0],
    browserWindowWidth = win.innerWidth || docElem.clientWidth || body.clientWidth,
    browserWindowHeight = win.innerHeight|| docElem.clientHeight|| body.clientHeight;  
    return {width:browserWindowWidth-offset,height:browserWindowHeight-offset}; 
} 
function onWindowResize()//called every time the window gets resized. 
{  
    let browserWindowSize = getBrowserWindowSize(); 
    resizeCanvas(browserWindowSize.width,browserWindowSize.height);  
    curve.resize(browserWindowSize.width,browserWindowSize.height); 
}
//gets the height of the curve, assuming that the the window was in 
//fullscreen mode and is now reduced to it's present dimensions
function getMaxHeight()
{ 
    let maxHeight = 60; 
    let fullScreenHeight = 644;//assumed browser window height of device  
    let dy  = height/fullScreenHeight;//percentage change in browser window height   
    maxHeight *= dy; 
    return maxHeight;   
}
function setNewCurve()
{
    let browserWindowSize = getBrowserWindowSize();  
    createCanvas(browserWindowSize.width,browserWindowSize.height);  
    let data = 
    {        
        //position the curve in the center of the screen
        xCoord: width/2,
        yCoord: height/2,
        //other params
        screenWidth: width,
        screenHeight: height,
        maxHeight: getMaxHeight(),
        color: 'white'
    };
    curve = new Curve(data);  
}  
function setup() 
{
    let browserWindowSize = getBrowserWindowSize();  
    createCanvas(browserWindowSize.width,browserWindowSize.height);  
    let data = 
    {        
        //position the curve in the center of the screen
        xCoord: width/2,
        yCoord: height/2,
        //other params
        screenWidth: width,
        screenHeight: height, 
        maxHeight: getMaxHeight(),
        color: 'white'
    };
    curve = new Curve(data);  
    window.addEventListener('resize',onWindowResize);
    document.addEventListener('click',(event)=>//when canvas is clicked,
    {    
        setNewCurve();//start the animation all over
    });
    background(backgroundColor);//black 
} 
function draw() 
{     
    smooth();   
    background(backgroundColor); 
    curve.update();
    curve.draw();  
}