'use strict';
// Shared by the assessment, its download, and the saved-results dashboard.
window.FDScoreInsights=scores=>{
 const high=Math.max(...scores.map(d=>d.score)),low=Math.min(...scores.map(d=>d.score));
 const strongest=scores.filter(d=>d.score===high),priorities=scores.filter(d=>d.score===low);
 const labels=items=>items.map(d=>d.label).join(' · ');
 const balanced=high===low;
 const summary=balanced
  ?'Your four areas are evenly rated at '+high+'%. No single area ranks above or below the others. Choose a focus that matters to your next goal.'
  :(strongest.length===1?'Your highest-rated area is ':'Your equally highest-rated areas are ')+labels(strongest)+'. '+(priorities.length===1?'Your lowest-rated area is ':'Your equally lowest-rated areas are ')+labels(priorities)+'.';
 const strengthTitle=balanced?'A balanced profile':labels(strongest);
 const strengthNote=balanced?'All four areas share the same rating. Your next step can follow your current goal.':strongest.length===1?'This is the area you rated most confidently. Keep building on it.':'These areas share your highest rating. Keep building on them.';
 const priorityTitle=balanced?'Choose your next focus':priorities.length===1?priorities[0].label:'Choose between equally rated areas';
 const planAdvice=balanced?'Choose one of the four founder areas and write down one practical action that supports your next goal.':priorities.length===1?priorities[0].advice:'Choose one of your equally lowest-rated areas ('+labels(priorities)+') and use its recommendation to define one practical action.';
 return {balanced,strongest,priorities,summary,strengthTitle,strengthNote,priorityTitle,planAdvice};
};
