# LibRank Demonstrator UI

This is the repository for the UI of the [LibRank](http://librank.info) demonstrator ([http://librank-demo.zbw.eu](http://librank-demo.zbw.eu)).

The purpose of the LibRank demonstrator is to interactively compose different ranking models and evaluate the effect on different test collections or individual tasks.

## Installation

* Install dependencies
  * `npm install`
  * `bower install`
* Run `gulp serve` to start the development server
* Run `gulp` to build for production (folder `dist/`)
 
The frontend communicates with a server component to get some basic data and to calculate the performance scores. Therefore, you must also install the [LibRank-Demonstrator-API](https://github.com/LibRank-Project/LibRank-Demonstrator-API).

