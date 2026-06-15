INSERT INTO settings(key, value)
SELECT 'shop_name', 'HiGi Photobooth & Coffee'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='shop_name');

INSERT INTO settings(key, value)
SELECT 'shop_address', 'Số 16B, Lô LK12 KĐA, Phan Đình Phùng, Tt. Quảng Hà, Hải Hà, Quảng Ninh'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='shop_address');

INSERT INTO settings(key, value)
SELECT 'shop_phone', '0338581366'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='shop_phone');

INSERT INTO settings(key, value)
SELECT 'bill_footer', 'Cảm ơn quý khách và hẹn gặp lại'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='bill_footer');

INSERT INTO settings(key, value)
SELECT 'sugar_levels', '0%,30%,50%,70%,100%'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='sugar_levels');

INSERT INTO settings(key, value)
SELECT 'ice_levels', 'Không,Ít,Vừa,Nhiều'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='ice_levels');

INSERT INTO categories(name, sort_order)
SELECT 'Latte', 10 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Latte');
INSERT INTO categories(name, sort_order)
SELECT 'Cà phê', 20 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Cà phê');
INSERT INTO categories(name, sort_order)
SELECT 'Sữa chua', 30 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Sữa chua');
INSERT INTO categories(name, sort_order)
SELECT 'Trà sữa', 40 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Trà sữa');
INSERT INTO categories(name, sort_order)
SELECT 'Nước ép', 50 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Nước ép');
INSERT INTO categories(name, sort_order)
SELECT 'Hot drinks', 60 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Hot drinks');
INSERT INTO categories(name, sort_order)
SELECT 'Đồ uống khác', 70 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Đồ uống khác');
INSERT INTO categories(name, sort_order)
SELECT 'Đồ ăn vặt', 80 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Đồ ăn vặt');

INSERT INTO toppings(name, price, sort_order)
SELECT 'Trân châu', 5000, 10 WHERE NOT EXISTS (SELECT 1 FROM toppings WHERE name='Trân châu');
INSERT INTO toppings(name, price, sort_order)
SELECT 'Kem cheese', 5000, 20 WHERE NOT EXISTS (SELECT 1 FROM toppings WHERE name='Kem cheese');

INSERT INTO areas(name, sort_order)
SELECT 'Tầng 1', 10 WHERE NOT EXISTS (SELECT 1 FROM areas WHERE name='Tầng 1');
INSERT INTO tables(area_id, name, seats, sort_order)
SELECT a.id, 'Bàn 1', 4, 10 FROM areas a WHERE a.name='Tầng 1' AND NOT EXISTS (SELECT 1 FROM tables WHERE name='Bàn 1');
INSERT INTO tables(area_id, name, seats, sort_order)
SELECT a.id, 'Bàn 2', 4, 20 FROM areas a WHERE a.name='Tầng 1' AND NOT EXISTS (SELECT 1 FROM tables WHERE name='Bàn 2');
INSERT INTO tables(area_id, name, seats, sort_order)
SELECT a.id, 'Bàn 3', 4, 30 FROM areas a WHERE a.name='Tầng 1' AND NOT EXISTS (SELECT 1 FROM tables WHERE name='Bàn 3');
INSERT INTO tables(area_id, name, seats, sort_order)
SELECT a.id, 'Bàn 4', 4, 40 FROM areas a WHERE a.name='Tầng 1' AND NOT EXISTS (SELECT 1 FROM tables WHERE name='Bàn 4');

WITH menu(category, name, price, sort_order, upsize_delta) AS (
  VALUES
    ('Latte','Matcha Latte',35000,10,10000),
    ('Latte','Matcha Latte Khoai Môn',40000,20,10000),
    ('Latte','Matcha Latte Dâu',40000,30,10000),
    ('Latte','Khoai Môn Latte',35000,40,10000),
    ('Latte','Khoai Môn Latte Cacao',40000,50,10000),
    ('Latte','Khoai Môn Latte Dâu',40000,60,10000),
    ('Latte','Cacao Latte',35000,70,10000),
    ('Latte','Cacao Latte Caramel',40000,80,10000),
    ('Latte','Cacao Latte Dâu',40000,90,10000),
    ('Latte','Cacao Latte Việt Quất',40000,100,10000),
    ('Latte','Cacao Latte Cà Phê',40000,110,10000),
    ('Cà phê','Đen Đá',20000,10,10000),
    ('Cà phê','Nâu Đá',20000,20,10000),
    ('Cà phê','Cafe Muối',25000,30,10000),
    ('Cà phê','Cafe Sữa Chua',30000,40,10000),
    ('Cà phê','Bạc Xỉu',25000,50,10000),
    ('Cà phê','Bạc Xỉu Kem Muối',30000,60,10000),
    ('Sữa chua','Sữa Chua Đánh Đá',25000,10,10000),
    ('Sữa chua','Sữa Chua Lắc Việt Quất',30000,20,10000),
    ('Sữa chua','Sữa Chua Lắc Xoài',30000,30,10000),
    ('Sữa chua','Sữa Chua Lắc Đào',30000,40,10000),
    ('Sữa chua','Sữa Chua Lắc Chanh Dây',30000,50,10000),
    ('Sữa chua','Sữa Chua Lắc Dâu Tây',30000,60,10000),
    ('Trà sữa','Trà Sữa Gạo Rang Trân Châu',35000,10,10000),
    ('Trà sữa','Hồng Trà Sữa Trân Châu',35000,20,10000),
    ('Trà sữa','Trà Sữa Nguyên Vị Trân Châu',35000,30,10000),
    ('Nước ép','Nước Ép Nguyên Vị',25000,10,10000),
    ('Nước ép','Nước Ép Mix Vị',30000,20,10000),
    ('Hot drinks','Cafe Sữa Nóng',25000,10,10000),
    ('Hot drinks','Bạc Xỉu Nóng',25000,20,10000),
    ('Hot drinks','Cacao Sữa Nóng',30000,30,10000),
    ('Hot drinks','Cacao Nóng Kem Muối',35000,40,10000),
    ('Hot drinks','Cacao Sữa Machiato',30000,50,10000),
    ('Hot drinks','Hồng Trà Sữa Nóng',30000,60,10000),
    ('Hot drinks','Matcha Latte Nóng',30000,70,10000),
    ('Hot drinks','Khoai Môn Latte Nóng',30000,80,10000),
    ('Hot drinks','Chocolate Nóng',35000,90,10000),
    ('Đồ uống khác','Trà Chanh Mật Ong',15000,10,5000),
    ('Đồ uống khác','Trà Quất',15000,20,5000),
    ('Đồ uống khác','Trà Quất Nha Đam',20000,30,0),
    ('Đồ uống khác','Trà Đào',20000,40,0),
    ('Đồ uống khác','Trà Tắc Xí Muội',20000,50,0),
    ('Đồ uống khác','Nước Dừa Cà Phê Hạt Chia',30000,60,0),
    ('Đồ ăn vặt','Hướng Dương Nguyên Vị/Vị Dừa',10000,10,0),
    ('Đồ ăn vặt','Bò Khô',80000,20,0),
    ('Đồ ăn vặt','Bánh Que Chấm Sốt',30000,30,0)
)
INSERT INTO products(category_id, name, base_price, description, image_path, sort_order)
SELECT c.id, menu.name, menu.price, NULL, NULL, menu.sort_order
FROM menu
JOIN categories c ON c.name = menu.category
WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.name = menu.name);

WITH menu(name, upsize_delta) AS (
  VALUES
    ('Matcha Latte',10000),('Matcha Latte Khoai Môn',10000),('Matcha Latte Dâu',10000),
    ('Khoai Môn Latte',10000),('Khoai Môn Latte Cacao',10000),('Khoai Môn Latte Dâu',10000),
    ('Cacao Latte',10000),('Cacao Latte Caramel',10000),('Cacao Latte Dâu',10000),
    ('Cacao Latte Việt Quất',10000),('Cacao Latte Cà Phê',10000),
    ('Đen Đá',10000),('Nâu Đá',10000),('Cafe Muối',10000),('Cafe Sữa Chua',10000),
    ('Bạc Xỉu',10000),('Bạc Xỉu Kem Muối',10000),
    ('Sữa Chua Đánh Đá',10000),('Sữa Chua Lắc Việt Quất',10000),('Sữa Chua Lắc Xoài',10000),
    ('Sữa Chua Lắc Đào',10000),('Sữa Chua Lắc Chanh Dây',10000),('Sữa Chua Lắc Dâu Tây',10000),
    ('Trà Sữa Gạo Rang Trân Châu',10000),('Hồng Trà Sữa Trân Châu',10000),
    ('Trà Sữa Nguyên Vị Trân Châu',10000),
    ('Nước Ép Nguyên Vị',10000),('Nước Ép Mix Vị',10000),
    ('Cafe Sữa Nóng',10000),('Bạc Xỉu Nóng',10000),('Cacao Sữa Nóng',10000),
    ('Cacao Nóng Kem Muối',10000),('Cacao Sữa Machiato',10000),('Hồng Trà Sữa Nóng',10000),
    ('Matcha Latte Nóng',10000),('Khoai Môn Latte Nóng',10000),('Chocolate Nóng',10000),
    ('Trà Chanh Mật Ong',5000),('Trà Quất',5000),
    ('Trà Quất Nha Đam',0),('Trà Đào',0),('Trà Tắc Xí Muội',0),('Nước Dừa Cà Phê Hạt Chia',0),
    ('Hướng Dương Nguyên Vị/Vị Dừa',0),('Bò Khô',0),('Bánh Que Chấm Sốt',0)
)
INSERT INTO product_sizes(product_id, name, price_delta, is_default)
SELECT p.id, 'M', 0, 1
FROM products p
JOIN menu ON menu.name = p.name
WHERE NOT EXISTS (SELECT 1 FROM product_sizes s WHERE s.product_id = p.id AND s.name = 'M');

WITH menu(name, upsize_delta) AS (
  VALUES
    ('Matcha Latte',10000),('Matcha Latte Khoai Môn',10000),('Matcha Latte Dâu',10000),
    ('Khoai Môn Latte',10000),('Khoai Môn Latte Cacao',10000),('Khoai Môn Latte Dâu',10000),
    ('Cacao Latte',10000),('Cacao Latte Caramel',10000),('Cacao Latte Dâu',10000),
    ('Cacao Latte Việt Quất',10000),('Cacao Latte Cà Phê',10000),
    ('Đen Đá',10000),('Nâu Đá',10000),('Cafe Muối',10000),('Cafe Sữa Chua',10000),
    ('Bạc Xỉu',10000),('Bạc Xỉu Kem Muối',10000),
    ('Sữa Chua Đánh Đá',10000),('Sữa Chua Lắc Việt Quất',10000),('Sữa Chua Lắc Xoài',10000),
    ('Sữa Chua Lắc Đào',10000),('Sữa Chua Lắc Chanh Dây',10000),('Sữa Chua Lắc Dâu Tây',10000),
    ('Trà Sữa Gạo Rang Trân Châu',10000),('Hồng Trà Sữa Trân Châu',10000),
    ('Trà Sữa Nguyên Vị Trân Châu',10000),
    ('Nước Ép Nguyên Vị',10000),('Nước Ép Mix Vị',10000),
    ('Cafe Sữa Nóng',10000),('Bạc Xỉu Nóng',10000),('Cacao Sữa Nóng',10000),
    ('Cacao Nóng Kem Muối',10000),('Cacao Sữa Machiato',10000),('Hồng Trà Sữa Nóng',10000),
    ('Matcha Latte Nóng',10000),('Khoai Môn Latte Nóng',10000),('Chocolate Nóng',10000),
    ('Trà Chanh Mật Ong',5000),('Trà Quất',5000)
)
INSERT INTO product_sizes(product_id, name, price_delta, is_default)
SELECT p.id, 'L', menu.upsize_delta, 0
FROM products p
JOIN menu ON menu.name = p.name
WHERE menu.upsize_delta > 0
  AND NOT EXISTS (SELECT 1 FROM product_sizes s WHERE s.product_id = p.id AND s.name = 'L');
