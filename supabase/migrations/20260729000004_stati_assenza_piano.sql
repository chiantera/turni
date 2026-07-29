-- Stati aggiuntivi mostrati nelle celle senza assegnazione del piano.
alter type tipo_assenza add value if not exists 'disciplinare';
alter type tipo_assenza add value if not exists 'studio';
