const { initDb, prepareRun, getDb } = require('./database');

const seedData = [
  { code: '110000', name: '北京市', parent_code: null, level: 'province' },
  { code: '110100', name: '北京市', parent_code: '110000', level: 'city' },
  { code: '110101', name: '东城区', parent_code: '110100', level: 'county' },
  { code: '110102', name: '西城区', parent_code: '110100', level: 'county' },
  { code: '110105', name: '朝阳区', parent_code: '110100', level: 'county' },
  { code: '110106', name: '丰台区', parent_code: '110100', level: 'county' },
  { code: '110108', name: '海淀区', parent_code: '110100', level: 'county' },
  { code: '310000', name: '上海市', parent_code: null, level: 'province' },
  { code: '310100', name: '上海市', parent_code: '310000', level: 'city' },
  { code: '310101', name: '黄浦区', parent_code: '310100', level: 'county' },
  { code: '310104', name: '徐汇区', parent_code: '310100', level: 'county' },
  { code: '310105', name: '长宁区', parent_code: '310100', level: 'county' },
  { code: '310115', name: '浦东新区', parent_code: '310100', level: 'county' },
  { code: '440000', name: '广东省', parent_code: null, level: 'province' },
  { code: '440100', name: '广州市', parent_code: '440000', level: 'city' },
  { code: '440103', name: '荔湾区', parent_code: '440100', level: 'county' },
  { code: '440104', name: '越秀区', parent_code: '440100', level: 'county' },
  { code: '440106', name: '天河区', parent_code: '440100', level: 'county' },
  { code: '440300', name: '深圳市', parent_code: '440000', level: 'city' },
  { code: '440304', name: '福田区', parent_code: '440300', level: 'county' },
  { code: '440305', name: '南山区', parent_code: '440300', level: 'county' },
  { code: '440306', name: '宝安区', parent_code: '440300', level: 'county' },
  { code: '330000', name: '浙江省', parent_code: null, level: 'province' },
  { code: '330100', name: '杭州市', parent_code: '330000', level: 'city' },
  { code: '330102', name: '上城区', parent_code: '330100', level: 'county' },
  { code: '330106', name: '西湖区', parent_code: '330100', level: 'county' },
  { code: '330108', name: '滨江区', parent_code: '330100', level: 'county' },
  { code: '320000', name: '江苏省', parent_code: null, level: 'province' },
  { code: '320100', name: '南京市', parent_code: '320000', level: 'city' },
  { code: '320102', name: '玄武区', parent_code: '320100', level: 'county' },
  { code: '320106', name: '鼓楼区', parent_code: '320100', level: 'county' },
  { code: '320115', name: '江宁区', parent_code: '320100', level: 'county' },
  { code: '510000', name: '四川省', parent_code: null, level: 'province' },
  { code: '510100', name: '成都市', parent_code: '510000', level: 'city' },
  { code: '510104', name: '锦江区', parent_code: '510100', level: 'county' },
  { code: '510107', name: '武侯区', parent_code: '510100', level: 'county' },
  { code: '420000', name: '湖北省', parent_code: null, level: 'province' },
  { code: '420100', name: '武汉市', parent_code: '420000', level: 'city' },
  { code: '420103', name: '江汉区', parent_code: '420100', level: 'county' },
  { code: '420106', name: '武昌区', parent_code: '420100', level: 'county' },
  { code: '420111', name: '洪山区', parent_code: '420100', level: 'county' },
];

async function seed() {
  await initDb();
  console.log('数据库已初始化，开始导入种子数据...');
  for (const row of seedData) {
    prepareRun(
      'INSERT OR IGNORE INTO regions (code, name, parent_code, level) VALUES (?, ?, ?, ?)',
      [row.code, row.name, row.parent_code, row.level]
    );
  }
  console.log('种子数据已导入:', seedData.length, '条区域记录');
}

seed().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
