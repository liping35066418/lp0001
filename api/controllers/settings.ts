import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound, forbidden, unauthorized } from '../utils/response.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';
import type { Settings } from '../../shared/api-types.js';

const router = Router();
const settingsRepo = new SettingsRepository();

router.use(authRequired, adminRequired);

const DEFAULT_PRICING: Settings.PricingRule = {
  overtimeUnit: 'half_hour',
  overtimeRate: 1.0,
  overtimeMode: 'ratio',
  minimumChargeMinutes: 60,
  freeGraceMinutes: 10,
  reminderMinutesBeforeEnd: 15,
};

const DEFAULT_GENERAL: Settings.GeneralSetting = {
  shopName: '桌游休闲馆',
  shopPhone: '',
  shopAddress: '',
  businessStartTime: '10:00',
  businessEndTime: '22:00',
  enabledPayMethods: ['cash', 'wechat', 'alipay'],
  receiptFooter: '感谢光临，欢迎再来！',
};

router.get('/pricing', async (req: Request, res: Response): Promise<void> => {
  try {
    const pricing = settingsRepo.getJSON<Settings.PricingRule>('pricing_rule', DEFAULT_PRICING);
    ok(res, pricing);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/pricing', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<Settings.PricingRule>;
    const current = settingsRepo.getJSON<Settings.PricingRule>('pricing_rule', DEFAULT_PRICING);
    const updated: Settings.PricingRule = {
      ...current,
      ...body,
    };
    settingsRepo.setJSON('pricing_rule', updated);
    ok(res, updated, '保存成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.get('/general', async (req: Request, res: Response): Promise<void> => {
  try {
    const general = settingsRepo.getJSON<Settings.GeneralSetting>('general_setting', DEFAULT_GENERAL);
    ok(res, general);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.put('/general', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<Settings.GeneralSetting>;
    const current = settingsRepo.getJSON<Settings.GeneralSetting>('general_setting', DEFAULT_GENERAL);
    const updated: Settings.GeneralSetting = {
      ...current,
      ...body,
    };
    settingsRepo.setJSON('general_setting', updated);
    ok(res, updated, '保存成功');
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export default router;
