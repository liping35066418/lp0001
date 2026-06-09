import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getDb } from '../api/utils/db.js';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

const DDL = `
CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','operator')) DEFAULT 'operator',
    phone TEXT,
    status TEXT NOT NULL CHECK (status IN ('active','disabled')) DEFAULT 'active',
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS room (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    spec TEXT NOT NULL CHECK (spec IN ('small','medium','large','vip')) DEFAULT 'medium',
    capacity INTEGER NOT NULL DEFAULT 4,
    base_price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('available','maintenance','disabled')) DEFAULT 'available',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS reservation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES room(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    people_count INTEGER NOT NULL DEFAULT 1,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','checked_in','cancelled','no_show')) DEFAULT 'pending',
    deposit_amount REAL NOT NULL DEFAULT 0,
    remark TEXT,
    created_by INTEGER NOT NULL REFERENCES user(id),
    session_id INTEGER REFERENCES session(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_reservation_room_time ON reservation(room_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_reservation_status ON reservation(status);

CREATE TABLE IF NOT EXISTS session (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES room(id),
    reservation_id INTEGER REFERENCES reservation(id),
    customer_name TEXT,
    customer_phone TEXT,
    people_count INTEGER NOT NULL DEFAULT 1,
    start_at TEXT NOT NULL,
    scheduled_end_at TEXT NOT NULL,
    actual_end_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('active','completed','void')) DEFAULT 'active',
    room_fee REAL NOT NULL DEFAULT 0,
    overtime_fee REAL NOT NULL DEFAULT 0,
    rental_fee REAL NOT NULL DEFAULT 0,
    goods_fee REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES user(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_session_status ON session(status);
CREATE INDEX IF NOT EXISTS idx_session_room ON session(room_id, status);

CREATE TABLE IF NOT EXISTS boardgame (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cover_image TEXT,
    category TEXT NOT NULL DEFAULT '其他',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard','expert')) DEFAULT 'medium',
    min_players INTEGER NOT NULL DEFAULT 2,
    max_players INTEGER NOT NULL DEFAULT 6,
    play_minutes INTEGER NOT NULL DEFAULT 60,
    accessories TEXT,
    deposit REAL NOT NULL DEFAULT 0,
    rental_fee REAL NOT NULL DEFAULT 0,
    stock_total INTEGER NOT NULL DEFAULT 1,
    stock_available INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('active','archived')) DEFAULT 'active',
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_boardgame_category ON boardgame(category);
CREATE INDEX IF NOT EXISTS idx_boardgame_status ON boardgame(status);

CREATE TABLE IF NOT EXISTS rental (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES session(id),
    boardgame_id INTEGER NOT NULL REFERENCES boardgame(id),
    deposit_collected REAL NOT NULL DEFAULT 0,
    rental_fee REAL NOT NULL DEFAULT 0,
    accessories_checked TEXT,
    status TEXT NOT NULL CHECK (status IN ('active','returned','damaged','lost')) DEFAULT 'active',
    rented_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    returned_at TEXT,
    accessories_returned TEXT,
    damage_fee REAL NOT NULL DEFAULT 0,
    deposit_refunded REAL NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES user(id),
    remark TEXT
);
CREATE INDEX IF NOT EXISTS idx_rental_status ON rental(status);
CREATE INDEX IF NOT EXISTS idx_rental_session ON rental(session_id);

CREATE TABLE IF NOT EXISTS goods_category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES goods_category(id),
    name TEXT NOT NULL,
    image TEXT,
    price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT '份',
    status TEXT NOT NULL CHECK (status IN ('on_sale','off_sale')) DEFAULT 'on_sale',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_goods_category ON goods(category_id);

CREATE TABLE IF NOT EXISTS session_goods_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES session(id),
    goods_id INTEGER NOT NULL REFERENCES goods(id),
    goods_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_goods_item_session ON session_goods_item(session_id);

CREATE TABLE IF NOT EXISTS bill (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_no TEXT NOT NULL UNIQUE,
    session_id INTEGER NOT NULL REFERENCES session(id),
    room_id INTEGER NOT NULL REFERENCES room(id),
    customer_name TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    room_fee REAL NOT NULL DEFAULT 0,
    overtime_fee REAL NOT NULL DEFAULT 0,
    rental_fee REAL NOT NULL DEFAULT 0,
    goods_fee REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    pay_method TEXT NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    change_amount REAL NOT NULL DEFAULT 0,
    deposit_refund REAL NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES user(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_bill_created ON bill(created_at);
CREATE INDEX IF NOT EXISTS idx_bill_pay ON bill(pay_method);

CREATE TABLE IF NOT EXISTS bill_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL REFERENCES bill(id),
    type TEXT NOT NULL CHECK (type IN ('room','overtime','rental','goods')),
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit_price REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL DEFAULT 0,
    ref_id INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES user(id),
    username TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id INTEGER,
    detail TEXT,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_log_user ON operation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_log_time ON operation_log(created_at);

CREATE TABLE IF NOT EXISTS waiting_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    people_count INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('waiting','calling','skipped','seated','cancelled')) DEFAULT 'waiting',
    queue_number INTEGER NOT NULL DEFAULT 0,
    room_spec TEXT CHECK (room_spec IN ('small','medium','large','vip')),
    assigned_room_id INTEGER REFERENCES room(id),
    called_at TEXT,
    called_expire_at TEXT,
    session_id INTEGER REFERENCES session(id),
    created_by INTEGER REFERENCES user(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_queue_status ON waiting_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_created ON waiting_queue(created_at);

CREATE TABLE IF NOT EXISTS member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    level TEXT NOT NULL CHECK (level IN ('normal','silver','gold','diamond')) DEFAULT 'normal',
    total_spend REAL NOT NULL DEFAULT 0,
    total_visits INTEGER NOT NULL DEFAULT 0,
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_member_phone ON member(phone);

CREATE TABLE IF NOT EXISTS coupon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percent','fixed')) DEFAULT 'fixed',
    value REAL NOT NULL DEFAULT 0,
    min_amount REAL NOT NULL DEFAULT 0,
    member_level TEXT CHECK (member_level IN ('normal','silver','gold','diamond')),
    expire_days INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS member_coupon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES member(id),
    coupon_id INTEGER NOT NULL REFERENCES coupon(id),
    status TEXT NOT NULL CHECK (status IN ('unused','used','expired')) DEFAULT 'unused',
    used_at TEXT,
    expire_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_member_coupon_member ON member_coupon(member_id, status);
`;

const DEFAULT_PRICING = JSON.stringify({
  overtimeUnit: 'half_hour',
  overtimeRate: 1.0,
  overtimeMode: 'ratio',
  minimumChargeMinutes: 60,
  freeGraceMinutes: 10,
  reminderMinutesBeforeEnd: 15,
});

const DEFAULT_GENERAL = JSON.stringify({
  shopName: '桌游空间站',
  shopPhone: '400-123-4567',
  shopAddress: '示例街道123号',
  businessStartTime: '10:00',
  businessEndTime: '02:00',
  enabledPayMethods: ['cash', 'wechat', 'alipay'],
  receiptFooter: '感谢光临，欢迎再来！',
});

function init(): void {
  const db = getDb();
  console.log('[DB] 开始初始化数据库...');

  db.exec(DDL);
  console.log('[DB] 表结构创建完成');

  const hash = (pwd: string) => bcrypt.hashSync(pwd, 10);

  const insertUser = db.prepare(`INSERT OR IGNORE INTO user (username, password_hash, real_name, role) VALUES (?, ?, ?, ?)`);
  insertUser.run('admin', hash('admin123'), '超级管理员', 'admin');
  insertUser.run('operator', hash('123456'), '前台操作员', 'operator');
  console.log('[DB] 默认用户创建完成 (admin/admin123, operator/123456)');

  const roomStmt = db.prepare(`INSERT OR IGNORE INTO room (name, spec, capacity, base_price, description) VALUES (?, ?, ?, ?, ?)`);
  roomStmt.run('A101', 'small', 4, 30, '小包厢，适合3-4人小聚');
  roomStmt.run('A102', 'small', 4, 30, '小包厢，温馨紧凑');
  roomStmt.run('A201', 'medium', 8, 50, '中包厢，标准配置');
  roomStmt.run('A202', 'medium', 8, 50, '中包厢，标准配置');
  roomStmt.run('A301', 'large', 12, 80, '大包厢，适合多人聚会');
  roomStmt.run('VIP01', 'vip', 15, 120, 'VIP豪华包厢，独立卫浴');
  console.log('[DB] 示例包厢创建完成');

  const catStmt = db.prepare(`INSERT OR IGNORE INTO goods_category (name, sort) VALUES (?, ?)`);
  catStmt.run('瓶装饮料', 1);
  catStmt.run('现调饮品', 2);
  catStmt.run('零食小吃', 3);
  catStmt.run('简餐', 4);

  const goodsStmt = db.prepare(`INSERT OR IGNORE INTO goods (category_id, name, price, stock, unit, status) VALUES (?, ?, ?, ?, ?, ?)`);
  goodsStmt.run(1, '可乐', 6, 100, '瓶', 'on_sale');
  goodsStmt.run(1, '雪碧', 6, 100, '瓶', 'on_sale');
  goodsStmt.run(1, '矿泉水', 3, 100, '瓶', 'on_sale');
  goodsStmt.run(2, '珍珠奶茶', 15, 50, '杯', 'on_sale');
  goodsStmt.run(3, '薯片', 10, 80, '袋', 'on_sale');
  goodsStmt.run(3, '瓜子', 8, 60, '袋', 'on_sale');
  goodsStmt.run(4, '泡面', 12, 40, '桶', 'on_sale');
  console.log('[DB] 示例商品创建完成');

  const bgStmt = db.prepare(`INSERT OR IGNORE INTO boardgame (name, category, difficulty, min_players, max_players, play_minutes, accessories, deposit, rental_fee, stock_total, stock_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  bgStmt.run('三国杀标准版', '卡牌', 'easy', 3, 10, 60, '卡牌x160,身份牌x10,血量牌x10,说明书x1', 100, 20, 3, 3);
  bgStmt.run('狼人杀', '聚会', 'easy', 6, 18, 45, '卡牌x36,号码牌x18,警徽x1', 80, 15, 2, 2);
  bgStmt.run('卡坦岛', '策略', 'medium', 3, 4, 90, '地图板x1,资源卡x95,建设卡x25,棋子x4套,骰子x2', 200, 35, 2, 2);
  bgStmt.run('璀璨宝石', '策略', 'medium', 2, 4, 45, '宝石筹码x90,发展卡x90,贵族卡x10', 150, 30, 2, 2);
  bgStmt.run('剧本杀-迷雾山庄', '推理', 'hard', 5, 8, 240, '剧本x8,线索卡x60,地图x1', 300, 80, 1, 1);
  bgStmt.run('UNO', '卡牌', 'easy', 2, 10, 30, '卡牌x108,说明书x1', 50, 10, 5, 5);
  bgStmt.run('大富翁经典版', '亲子', 'easy', 2, 6, 90, '棋盘x1,棋子x6,骰子x2,地契卡x28,钱币套装x1', 120, 20, 2, 2);
  bgStmt.run('展翅翱翔', '策略', 'hard', 1, 5, 60, '主版图x1,鸟类卡x170,蛋x100,食物tokenx50', 350, 50, 1, 1);
  console.log('[DB] 示例桌游创建完成');

  const memberStmt = db.prepare(`INSERT OR IGNORE INTO member (name, phone, level, total_spend, total_visits, remark) VALUES (?, ?, ?, ?, ?, ?)`);
  memberStmt.run('张三', '13800138000', 'diamond', 8860.5, 42, 'VIP钻石会员，经常来');
  memberStmt.run('李四', '13900139000', 'gold', 3280, 18, '金卡会员');
  memberStmt.run('王五', '13700137000', 'silver', 1560, 8, '银卡会员');
  memberStmt.run('赵六', '13600136000', 'normal', 320, 3, '普通会员');
  console.log('[DB] 示例会员创建完成');

  const couponStmt = db.prepare(`INSERT OR IGNORE INTO coupon (name, type, value, min_amount, member_level, expire_days, status, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  couponStmt.run('新客满100减20', 'fixed', 20, 100, null, 90, 'active', '首次到店消费满100元可用');
  couponStmt.run('银卡专属9折券', 'percent', 90, 0, 'silver', 30, 'active', '银卡及以上会员专属9折');
  couponStmt.run('金卡满200减50', 'fixed', 50, 200, 'gold', 30, 'active', '金卡及以上会员满200减50');
  couponStmt.run('钻石专属8折', 'percent', 80, 0, 'diamond', 60, 'active', '钻石会员专属8折券');
  couponStmt.run('包厢时长立减30', 'fixed', 30, 0, null, 30, 'active', '全场通用，包厢时长立减30');
  console.log('[DB] 示例优惠券创建完成');

  const mcStmt = db.prepare(`INSERT OR IGNORE INTO member_coupon (member_id, coupon_id, status, expire_at) VALUES (?, ?, 'unused', ?)`);
  const now = dayjs();
  mcStmt.run(1, 4, now.add(60, 'day').format('YYYY-MM-DD HH:mm:ss'));
  mcStmt.run(1, 5, now.add(30, 'day').format('YYYY-MM-DD HH:mm:ss'));
  mcStmt.run(2, 3, now.add(30, 'day').format('YYYY-MM-DD HH:mm:ss'));
  mcStmt.run(2, 5, now.add(30, 'day').format('YYYY-MM-DD HH:mm:ss'));
  mcStmt.run(3, 2, now.add(30, 'day').format('YYYY-MM-DD HH:mm:ss'));
  mcStmt.run(4, 1, now.add(90, 'day').format('YYYY-MM-DD HH:mm:ss'));
  console.log('[DB] 会员优惠券示例创建完成');

  const settingStmt = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  settingStmt.run('pricing_rule', DEFAULT_PRICING);
  settingStmt.run('general_setting', DEFAULT_GENERAL);
  console.log('[DB] 系统配置初始化完成');

  console.log('[DB] ✅ 数据库初始化成功！');
}

init();
