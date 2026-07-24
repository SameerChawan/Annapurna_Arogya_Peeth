-- Run this in Supabase SQL Editor to create the products table
CREATE TABLE IF NOT EXISTS aap_products (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL DEFAULT '',
  name_mr TEXT NOT NULL DEFAULT '',
  description_en TEXT DEFAULT '',
  description_mr TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  weight_kg NUMERIC DEFAULT 1,
  badge_en TEXT DEFAULT '',
  badge_mr TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  tags_mr TEXT[] DEFAULT '{}',
  icon TEXT DEFAULT '',
  emoji TEXT DEFAULT '',
  image TEXT DEFAULT '',
  category TEXT DEFAULT 'millet',
  active BOOLEAN DEFAULT true,
  ingredients_en TEXT DEFAULT '',
  ingredients_mr TEXT DEFAULT '',
  nutrition JSONB DEFAULT '{"calories":0,"protein":0,"fiber":0,"carbs":0,"fat":0}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert seed products (skip if already exist)
INSERT INTO aap_products (id, name_en, name_mr, description_en, description_mr, price, weight_kg, badge_en, badge_mr, tags, tags_mr, icon, emoji, image, category, active, ingredients_en, ingredients_mr, nutrition)
VALUES
  ('diabetic-atta', 'Diabetic Atta', 'मधुमेह पीठ', 'Specially crafted low-GI blend for diabetics. Enjoy rotis, bhakri & dosa without blood sugar spikes.', 'मधुमेहींसाठी विशेष कमी GI मिश्रण. रक्तातील साखर न वाढता भाकरी, घावणे आणि डोसा आनंदाने खावा.', 250, 1, 'Diabetic Friendly', 'मधुमेह अनुकूल', '{"Low GI","High Fiber","Sugar Free"}', '{"कमी GI","उच्च फायबर","साखरमुक्त"}', 'fa-heartbeat', '💓', '', 'specialty', true, 'Whole wheat flour, barley flour, fenugreek powder, flaxseed meal, jambun powder, cinnamon, turmeric, chickpea flour', 'कडधान्य पीठ, बार्ली पीठ, मेथी पूड, अलशी पूड, जांभुळ पूड, दालचिनी, हळद, हरभरा पीठ', '{"calories":320,"protein":12,"fiber":14,"carbs":52,"fat":4}'),
  ('barley-dosa-atta', 'Barley Dosa Atta', 'बार्ली डोसा पीठ', 'High-fiber barley flour for crispy, golden dosas. A powerhouse of nutrition in every bite.', 'कुरकुरीत, सोनेरी डोशांसाठी उच्च फायबर बार्ली पीठ. प्रत्येक टोकात पोषणाचा खजिना.', 275, 1, 'Heart Healthy', 'हृदयासाठी चांगले', '{"High Fiber","Rich in Manganese","Low GI"}', '{"उच्च फायबर","मँगेनीज समृद्ध","कमी GI"}', 'fa-seedling', '🌾', '', 'millet', true, 'Pearl barley flour, whole wheat flour, rice flour, fenugreek, salt', 'बार्ली पीठ, कडधान्य पीठ, तांदूळ पीठ, मेथी, मीठ', '{"calories":334,"protein":10,"fiber":17,"carbs":62,"fat":2}'),
  ('moong-dal-dosa-atta', 'Moong Dal Dosa Atta', 'मूग डाळ डोसा पीठ', 'Protein-packed moong dal blend for soft, nutritious dosas. Start your day with pure energy.', 'प्रथिनेने भरलेले मूग डाळ मिश्रण. दररोज सकाळी शुद्ध ऊर्जेने भरा.', 275, 1, 'High Protein', 'उच्च प्रथिने', '{"High Protein","Easy Digest","Gluten Free"}', '{"उच्च प्रथिने","सहज पचन","ग्लूटन मुक्त"}', 'fa-dumbbell', '💪', '', 'dal', true, 'Green gram flour, rice flour, cumin, asafoetida, salt', 'मूग डाळ पीठ, तांदूळ पीठ, जिरे, हिंग, मीठ', '{"calories":347,"protein":24,"fiber":16,"carbs":48,"fat":1.5}'),
  ('nachani-dosa-atta', 'Nachani (Ragi) Dosa Atta', 'नाचणी डोसा पीठ', 'Calcium-rich finger millet (ragi) flour. Stronger bones, better health, naturally.', 'कॅल्शियमयुक्त नाचणी पीठ. नैसर्गिकरित्या मजबूत हाडे, उत्तम आरोग्य.', 225, 1, 'Calcium Rich', 'कॅल्शियम समृद्ध', '{"Calcium Rich","Iron Rich","Gluten Free"}', '{"कॅल्शियम समृद्ध","लोह समृद्ध","ग्लूटन मुक्त"}', 'fa-bone', '🦴', '', 'millet', true, 'Finger millet flour, rice flour, urad dal flour, fenugreek, salt', 'नाचणी पीठ, तांदूळ पीठ, उडीद डाळ पीठ, मेथी, मीठ', '{"calories":328,"protein":7.3,"fiber":3.6,"carbs":72,"fat":1.3}'),
  ('jwari-dosa-atta', 'Jwari (Jowar) Dosa Atta', 'ज्वारी डोसा पीठ', 'The king of millets. Classic sorghum flour for traditional bhakri and dosas, just like grandma made.', 'बाजरींचा राजा. आजीसारखी पारंपारिक भाकरी आणि डोसा — अक्षरशः घरगुती.', 225, 1, 'Traditional Recipe', 'पारंपारिक', '{"Gluten Free","Iron Rich","Fiber Rich"}', '{"ग्लूटन मुक्त","लोह समृद्ध","फायबर समृद्ध"}', 'fa-wheat-awn', '🌾', '', 'millet', true, 'Sorghum flour, rice flour, cumin, salt', 'ज्वारी पीठ, तांदूळ पीठ, जिरे, मीठ', '{"calories":329,"protein":10.4,"fiber":6.7,"carbs":72,"fat":1.7}'),
  ('bajri-dosa-atta', 'Bajri (Bajra) Dosa Atta', 'बाजरी डोसा पीठ', 'Pearl millet power. Loaded with iron and essential minerals for an energy-packed morning.', 'बाजरीची शक्ती. लोह आणि आवश्यक खनिजांनी भरलेले — ऊर्जावान सकाळीसाठी.', 200, 1, 'Energy Booster', 'ऊर्जावर्धक', '{"Iron Rich","Energy Boost","Gluten Free"}', '{"लोह समृद्ध","ऊर्जावर्धक","ग्लूटन मुक्त"}', 'fa-bolt', '⚡', '', 'millet', true, 'Pearl millet flour, rice flour, urad dal flour, salt', 'बाजरी पीठ, तांदूळ पीठ, उडीद डाळ पीठ, मीठ', '{"calories":378,"protein":11.6,"fiber":11.5,"carbs":67,"fat":5}'),
  ('mixed-dal-dosa-atta', 'Mixed Dal Dosa Atta', 'मिक्स डाळ डोसा पीठ', 'A symphony of lentils. Multiple dals blended for a complete protein profile in every dosa.', 'डाळींची सिम्फनी. प्रत्येक डोसात संपूर्ण प्रथिने — अनेक डाळींचे मिश्रण.', 250, 1, 'Complete Protein', 'संपूर्ण प्रथिने', '{"Complete Protein","High Fiber","Energy Rich"}', '{"संपूर्ण प्रथिने","उच्च फायबर","ऊर्जायुक्त"}', 'fa-plate-wheat', '🥘', '', 'dal', true, 'Chana dal, moong dal, urad dal, toor dal, rice flour, cumin, asafoetida, turmeric, salt', 'चणा डाळ, मूग डाळ, उडीद डाळ, तूर डाळ, तांदूळ पीठ, जिरे, हिंग, हळद, मीठ', '{"calories":340,"protein":20,"fiber":12,"carbs":55,"fat":3}')
ON CONFLICT (id) DO NOTHING;
