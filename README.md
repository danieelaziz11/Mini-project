# تسعير العربيات المستعملة (Flask)

## التشغيل

```bash
python -m venv .venv
.venv\Scripts\activate          # على Windows   (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt

# 1) حط ملف الـ CSV بتاعك في فولدر data/ وبعدين درّب النموذج
python train_model.py --csv data/used_car_listings_dataset_from_hatla2ee2026.csv

# 2) شغّل الموقع
python app.py                   # افتح http://127.0.0.1:5000
```

`train_model.py` بيكرر نفس خطوات النوتبوك (تنضيف السعر والعداد، أعلى 20 ماركة، سعر <= 50 مليون،
OneHot للماركة/الموديل/الوقود/الناقل، XGBoost بنفس الإعدادات) وبيحفظ `model/pipeline.joblib` و`model/meta.json`.
لو غيّرت الداتا أو الإعدادات، أعد التدريب بس.

## الهيكل

```
app.py               # Flask + /api/predict
train_model.py       # التدريب وحفظ الموديل
templates/index.html # الصفحة
static/css/style.css
static/js/app.js     # العداد، العدّاد الدوّار، الرسم، الأنيميشن
```

## ملاحظات

- المدى المتوقع محسوب من نسبة (السعر الحقيقي / المتوقع) على بيانات الاختبار (من 10% لـ 90%)، مش رقم ثابت.
- النموذج النهائي بيتدرّب على كل الداتا، والـ MAE وR² اللي في أسفل الصفحة من الـ 20% اختبار.
- الأنيميشن بيحترم إعداد "تقليل الحركة" في النظام.
