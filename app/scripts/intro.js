function startIntro(){
  var intro = introJs();
  intro.setOptions({
    steps: [
      {
	intro: "Welcome to the LibRank demonstrator! This is a quick tour through the features of the demonstrator. In short, the purpose of the demonstrator is to interactively compose different ranking models and evaluate the effect on the mean performance or on individual tasks.<br/><br/>Note: You can use the arrow keys to navigate through the tour.",
	tooltipClass: 'intro-tooltip-large'
      },
      {
      	element: jQuery('.panel.ranking-model').get(0),
        intro: "This is the ranking model panel. Here you can compose a ranking model and interactively adjust the weights of individual features.",
	position: "right"
      },      
      {
      	element: jQuery('#add-feature-toggle').get(0),
        intro: "You can add features to the model.",
	position: "right"
      },      
      {
      	element: jQuery('.panel.ranking-model ranking-model a').get(0),
        intro: "Or you can select one of the predefined rankings.",
	position: "right"
      },      
      {
      	element: jQuery('.panel.ranking-model ranking-model .save_baseline').get(0),
        intro: "If you have setup a model, you can set it as a baseline model.",
	position: "right"
      },      
      {
      	element: jQuery('.panel.panel-performance').get(0),
        intro: "In the performance panel you can see the mean performance of the current model and of the baseline model. The performance scores update on every change you make in the ranking model panel.<br/><br/>NOTE: The performance values for the predefined rankings might not be exactly the same as in the evaluation report. This is due to differences how documents with tied scores are ranked. Further, some errors in the rankings have been fixed here.",
	position: "right"
      },
      {
      	element: jQuery('#chart').get(0),
        intro: "If you have selected a baseline model, here you will see a chart with the per task performance differences between the current model and the baseline model. When changing weights in the ranking model you can get a quick grasp about which tasks are affected the most.",
	position: "left"
      },
      {
      	element: jQuery('#panel-tasks').get(0),
        intro: "This panel lists the individual tasks and the corresponding per task performance scores. You can select the different tasks from the three evaluation runs.",
	position: "right",
	scrollToElement: false
      },
      {
      	element: jQuery('#panel-result-list').get(0),
        intro: "Here you can inspect the result list of an individual task. You can select a task in the tasks panel or in the chart.",
	position: "left"
      },
      {
      	element: jQuery('#panel-result-list .header').get(0),
        intro: "This is the actual task description given to the assessors for this task.",
	position: "left"
      },
      {
      	element: jQuery('#panel-result-list .result-list result-list-item .qrel').get(0),
        intro: "This is the gradual relevance judgment for the document. Green indicates that it has been judged relevant on the binary scale and red indicates that it has been judged non-relevant.",
	position: "bottom"
      },
      {
      	element: jQuery('#panel-result-list .result-list result-list-item .pos').get(0),
        intro: "This is the current rank of the document with respect to the current ranking model. If you have selected a baseline model the rank of the document with respect to the result list of the baseline model will be given in parentheses.",
	position: "bottom"
      },
      {
      	element: jQuery('#panel-result-list .result-list result-list-item .record').get(0),
        intro: "The background color indicates the difference between the gradual relevance judgment of the document and the ideal judgment for this rank. Green indicates that the current document is more relevant and red indicates that the document is less relevant. The shade of the color indicates the magnitude of the deviation.<br/>You can hover over a record to see the actual feature values.",
	position: "bottom"
      },
    ]
  });

  intro.oncomplete(function() {
    window.scrollTo(0,0);
  });
  intro.start();
}
