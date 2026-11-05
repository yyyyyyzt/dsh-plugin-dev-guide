import json,pathlib,statistics,collections
root=pathlib.Path('/root/research/hark-audit/repository/HARK-Human-Gated-Authority-Typed-Review-Knowledge-b566b08de2976451747215af4dc874a0846f6173')
runs={name:json.loads(next((root/'paper/data/public/eval-runs').glob(name+'_*_r0_*.json')).read_text()) for name in ['B0','S-full','S-verifier']}
out={}
for name,r in runs.items():
 p=r['perSolution']; tp=sum(len(set(x['truth'])&set(x['predicted'])) for x in p);fp=sum(len(set(x['predicted'])-set(x['truth'])) for x in p);fn=sum(len(set(x['truth'])-set(x['predicted'])) for x in p)
 labels=['通过','建议整改','不通过'];cm=[[sum(x['expectedVerdict']==a and x['predictedVerdict']==b for x in p) for b in labels] for a in labels]; pe=sum(sum(cm[i])*sum(row[i] for row in cm) for i in range(3))/len(p)**2;acc=sum(cm[i][i] for i in range(3))/len(p)
 out[name]={'TP':tp,'FP':fp,'FN':fn,'F1':2*tp/(2*tp+fp+fn),'mean_per_proposal_F1':statistics.mean(x['f1'] for x in p),'confusion':cm,'accuracy':acc,'kappa':(acc-pe)/(1-pe),'empty_truth':sum(not x['truth'] for x in p),'empty_truth_no_prediction':sum(not x['truth'] and not x['predicted'] for x in p),'defective':sum(bool(x['truth']) for x in p),'submitted':sum(x['submitted'] for x in p),'rejected':sum(x['gateRejects'] for x in p),'pending_total':sum(len(x['pending']) for x in p),'pending_min_median_max':[min(len(x['pending']) for x in p),statistics.median(len(x['pending']) for x in p),max(len(x['pending']) for x in p)],'pending_covered_FN':sum(len((set(x['truth'])-set(x['predicted']))&set(x['pending'])) for x in p),'F1perfect':sum(x['f1']==1 for x in p),'F1median':statistics.median(x['f1'] for x in p)}
 if name=='S-full':
  out[name]['hybrid_count_discrepancies']=[{'id':x['id'],'hybrid_predictions':[k for k,v in x['predictedTiers'].items() if v=='hybrid'],'submitted':x['submitted'],'rejected':x['gateRejects']} for x in p if sum(v=='hybrid' for v in x['predictedTiers'].values())!=x['submitted']-x['gateRejects']]
  out[name]['severity']={s:{k:sum(x[k] for x in r['perRule'] if x['severity']==s) for k in ['tp','fp','fn']} for s in ['blocker','major','minor']}
out['delta_micro_F1']=out['S-full']['F1']-out['B0']['F1'];out['delta_mean_proposal_F1']=out['S-full']['mean_per_proposal_F1']-out['B0']['mean_per_proposal_F1']
p=runs['S-full']['perSolution'];sev={x['ruleId']:x['severity'] for x in runs['S-full']['perRule']}
passes=[x for x in p if x['expectedVerdict']=='通过'];out['pass_partition']={'count':len(passes),'with_truth':sum(bool(x['truth']) for x in passes),'with_predictions':sum(bool(x['predicted']) for x in passes),'prediction_count_distribution':dict(collections.Counter(len(x['predicted']) for x in passes)),'defective_predicted_pass':sum(bool(x['truth']) and x['predictedVerdict']=='通过' for x in p),'all_predicted_pass':sum(x['predictedVerdict']=='通过' for x in p)}
out['theta']={}
for theta in [1,2,3,4,5]:
 def verdict(x):
  c=collections.Counter(sev[r] for r in x['predicted']);return '不通过' if c['blocker'] else '建议整改' if c['major'] or c['minor']>=theta else '通过'
 labels=['通过','建议整改','不通过'];cm=[[sum(x['expectedVerdict']==a and verdict(x)==b for x in p) for b in labels] for a in labels];acc=sum(cm[i][i] for i in range(3))/100;pe=sum(sum(cm[i])*sum(row[i] for row in cm) for i in range(3))/10000
 out['theta'][theta]={'accuracy':acc,'kappa':(acc-pe)/(1-pe),'confusion':cm}
out['repetitions_identical']={n:all(json.loads(f.read_text())['metrics']==r['metrics'] and json.loads(f.read_text())['perSolution']==r['perSolution'] for f in (root/'paper/data/public/eval-runs').glob(n+'_*')) for n,r in runs.items()}
print(json.dumps(out,ensure_ascii=False,indent=2))
