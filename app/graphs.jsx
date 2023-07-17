//# HTML endpoints -- graphs
//
//@app.route('/a/graphs/', methods=['GET'])
//def graphs_index():
//    sleeps = Span.query.join(SpanTag).join(Tag).join(Event).join(User).filter(
//        Tag.name == 'sleep', User.name == request.user.name
//    ).all()
//
//    sleeps = [s for s in sleeps if 0 < s.duration_s / 3600 < 12]
//    start_date = arrow.utcnow().shift(years=-1)
//    mood_utcs = []
//    moods = collections.defaultdict(list)
//    for ev in Event.query.join(User).join(Mood).filter(
//            User.name == request.user.name,
//            Event.utc > start_date.date(),
//            Event.mood is not None):
//        mood_utcs.append(ev.utctime)
//        moods['happy'].append(ev.mood.happy or 0)
//        moods['sad'].append(ev.mood.sad or 0)
//        moods['angry'].append(ev.mood.angry or 0)
//        moods['afraid'].append(ev.mood.afraid or 0)
//        moods['polarity'].append(ev.mood.polarity or 0)
//
//    now = arrow.utcnow()
//    heatmap = np.zeros((36, 100))
//    for sleep in sleeps:
//        weeks_ago = (now - sleep.first_event.utctime).total_seconds() / (7 * 86400)
//        week = min(len(heatmap[0]) - 1, int(weeks_ago))
//        dur = min(len(heatmap) - 1, int(sleep.duration_s / 1200))
//        heatmap[dur, week] += 0.6
//        heatmap[min(len(heatmap) - 1, dur + 1), week] += 0.1
//        heatmap[max(0, dur - 1), week] += 0.1
//        heatmap[dur, min(len(heatmap[0]) - 1, week + 1)] += 0.1
//        heatmap[dur, max(0, week - 1)] += 0.1
//
//    rbf = gp.kernels.RBF(14, (1, 14))
//    white = gp.kernels.WhiteKernel(0.001)
//    deltas = [[(u - start_date).total_seconds() / 86400] for u in mood_utcs]
//    grid = np.linspace(0, max(deltas)[0], 500)
//    model_utcs = [start_date.shift(days=d).isoformat() for d in grid]
//    models = {}
//    for name, values in moods.items():
//        if name == 'utc': continue
//        m = gp.GaussianProcessRegressor(kernel=rbf + white, alpha=1e-10,
//                                        n_restarts_optimizer=9)
//        m.fit(deltas, values)
//        mu, sigma = m.predict(grid[:, None], return_std=True)
//        prev_g = prev_m = 0
//        visible = []
//        for t, g, m, s in zip(model_utcs, grid, mu, sigma):
//            if max(abs(prev_g - g), 100 * abs(prev_m - m)) > 2.5:
//                visible.append((t, m, s))
//                prev_g, prev_m = g, m
//        models[name] = visible
//
//    colors = dict(
//        happy='255,153,0',   #f90
//        sad='102,153,204',   #69c
//        angry='204,0,0',     #c00
//        afraid='0,153,0',    #090
//        polarity='17,17,17', #111
//    )
//
//    return render_template('graphs_index.html',
//                           current='graphs',
//                           colors=colors,
//                           user=request.user,
//                           sleeps=sleeps,
//                           heatmap=heatmap,
//                           mood_utcs=mood_utcs,
//                           moods=moods,
//                           model_utcs=model_utcs,
//                           models=models)


const Graphs = () => 'Graphs.'


export { Graphs }
