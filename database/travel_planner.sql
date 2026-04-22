-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Dec 09, 2025 at 04:16 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `travel_planner`
--

-- --------------------------------------------------------

--
-- Table structure for table `points`
--

CREATE TABLE `points` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `lat` decimal(9,6) NOT NULL,
  `lng` decimal(9,6) NOT NULL,
  `place_id` varchar(64) DEFAULT NULL,
  `photo_url` text DEFAULT NULL,
  `meta_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta_json`)),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `points`
--

INSERT INTO `points` (`id`, `name`, `lat`, `lng`, `place_id`, `photo_url`, `meta_json`, `updated_at`) VALUES
(1, 'Bukittinggi', -0.304926, 100.369570, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(2, 'Sianok Canyon', -0.250447, 100.350725, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(3, 'Lake Maninjau (kelok 44)', -0.297593, 100.224541, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(4, 'Parapat', 2.668688, 98.936978, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(5, 'Samosir Island', 2.754796, 98.745842, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(6, 'Holbung Hill', 2.530478, 98.697879, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(7, 'Sipiso-piso Waterfall', 2.918554, 98.523192, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(8, 'Lampuuk Beach', 5.485523, 95.226464, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(9, 'Mount Seulawah Agam', 5.421673, 95.638180, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(10, 'Jantho Forest Reserve', 5.285510, 95.613590, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(11, 'Mount Bromo', -7.935149, 112.953739, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(12, 'Tumpak Sewu Waterfall', -8.228253, 112.919767, 'ChIJuzWDMHsRBDERhyITN2TwRu4', 'https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU5beCpT6ivoRcTsj53GZ_xFkv7eSN-rQkNJ1o8qr92VsSi_LRJZGVD02kQbYg9FXccGyBhAs0tFSu2VOFe-EIAvDuIyYZC4bznaIGiRPjd1ClLj61397BO9lzJ9lEnqljAwC0-t3ls_GG5BRtiHqbLC5JOgTA9xZEwz2qz34d-nQtDQvvS0BHIG2Q23dd3BHV3KJ3E56SsBp28gh-OZF5Igu2_EcAmiHc6Rixfk83JI56ShjneLZsoRnZUkMkao5tEW7CMzRA-7sQSVGR1QxRlcXG0fsoYnjPEpb61Nqb4SqdlLpQnmyewDt7X_TQjJjsqgI4jHr2jzcLnWJvZMBd-gDR7Y0t5TqZQX4CsIi5ChgbwCB9tl-_gZBNiT7v_8bundm27bYM0XCaO-tOAU_NlGVw_708sq35NlbIblzxEwjchQAW5MDvqmgf_OYZnUyaklON2IRreuvcCBrNPKLwachgOh1KGea7fr8T5j5muea2SdhxHG1Z_zbBE_nuhC13von3lanRU2wuJoBOa1zRqBkWIkYmENBmA_mUA-r9zVAZPFxqNGjBQkWUMYXaeBgAV0mw&3u1200&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap.html&key=AIzaSyAsaL-ab3KOriokRrwZq_dfWtJzwaJR4KY&token=44542', NULL, '2025-11-12 16:57:24'),
(13, 'Malang Old Town', -7.982042, 112.630714, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(14, 'Borobudur Temple', -7.607674, 110.203704, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(15, 'Prambanan Temple', -7.751851, 110.491661, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(16, 'Merapi Kaliurang', -7.616930, 110.417403, 'ChIJaU-XdXAaBDER-T037O8-Tlw', 'https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU4ZSVI3OfkfrJya_7ppgXz27T29AlZQAPpXsIJJRdp1ztqhG98Ghq5LGr7IdaAvSYrsTAF2HMvYAFLDuNsX6TPXPvttfaY_3X5JQVtis-kx-RmY8__RAjELyaX2wdZLYw8L8tLNulv7LpBdaNrJ4i_3zAlgH4Fr2t_QPTMFno0wmlJCfRMxZ5874TZLejgRQCblEqvMpM9x35r9hATosDKufww8VcRHim3hPKOPAmMfdjMC-iBbZZkhFYr0-_oO7qCLFgRHNce_I3tyb8JMfdQ7nPED6aTzZp69sm27IRukeKdMS_MHAaoYnhsWiG10Tc6EyuQRHA5wh14Zc_RAPnuA6qHDoEZRcjH7qbUOeWzTWTvbbI1CD54BR6j6gQ43qAPNtjeYq1UZHxSKDGnOs2tIi7WAjZ9Dn59rhCh0Vbt5ultICB7juMpvL38o429BvpBO484s_30aubXewkahCKCz-sBCN6Q4MtfS8D8Is7O_8nSKRfcBilR4cT0E_evYjeXT9WdahiDpK83A_-rQwgg65KBkORZlAtM_5EaNP-ogRte9yd7z-ssx0qhe9Tu83YtblqDf&3u1200&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap.html&key=AIzaSyAsaL-ab3KOriokRrwZq_dfWtJzwaJR4KY&token=47990', NULL, '2025-11-12 16:57:20'),
(17, 'Sikunir Sunrise', -7.233920, 109.918643, 'ChIJA8nXbQANcC4R8_delJCLhR4', 'https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU5uG1qa9IvDTYmxKX5d84nB_7pJB5NKSDe66bHWKEhiE-jM9G0DaPBLGi4fzOqFlXs1DxZ7pYXV4P-VS_hToRul5vfgBqUUiH0y7esURMvWgeKxsmh34SPGm8Q0Yg2kC0M3hgqIC-0t5pjy3BsEIE5Pk8jdRcsTf95pT2_Pvb5YqL0D7sSFXTKLqdqRs-ssYzbbNTfjVdwKoES7JLCJDcxVsUBninoXYRlvf65hCIW4mKpOKMg9nKfQUYGigGsthm1zDhp9ohohvcNtGqXRDILJh6hPjn9Yf81-Ye_sHW6hap6UdTb4ph39kwR8Pdez04BQ9eVMBzw&3u1200&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyAsaL-ab3KOriokRrwZq_dfWtJzwaJR4KY&token=117075', NULL, '2025-11-11 13:11:47'),
(18, 'Telaga Warna', -7.112932, 109.963789, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(19, 'Sikidang Crater', -7.219967, 109.903952, 'ChIJzxvRPrsNcC4R3sIH3PKgX38', 'https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU4LshWPBvaSLm3wZJWsUqcOanhEasR0InchYmg6bCqRLO90GTVTzcWnYmDbHYS7bNr1FBP0zEuPRm-BvCj6T5-qZZltflLsRPB_s7ja2YiNS5cjmq_IYlX5tSv6c5pA_1hVG9isXko1QvLb_A-MjRBbiy0cCR5slJgawI8qJBBqCLRUzcLA2Pp47P_4w5XaXWEzgEiWvymmjkfkHb6cB0QAvyIDLfFboST53psl1JmjeTbGdkDIBGVI0FXv9tbYSNwibhwH66kGwPFUJs2H8lI_QSr0rgo4NF2IRJ0GworqfYLyqE80QgRc_4O7257w-LHt4fXzlZk&3u1200&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyAsaL-ab3KOriokRrwZq_dfWtJzwaJR4KY&token=28080', NULL, '2025-11-11 13:12:19'),
(20, 'Tegallalang Rice Terrace', -8.431650, 115.279301, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(21, 'Tukad Cepung Waterfall', -8.440869, 115.387340, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(22, 'Mount Batur Viewpoint', -8.251479, 115.381240, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(23, 'Sendang Gile & Tiu Kelep', -8.301400, 116.409251, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(24, 'Malimbu Hill', -8.442750, 116.033634, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(25, 'Gili Air', -8.363892, 116.082405, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(26, 'Kete Kesu', -3.001095, 119.912251, 'ChIJO2fVvgnpky0R3Om-a9pL1bg', 'https://picsum.photos/seed/gmtrip/640/400', NULL, '2025-11-11 13:05:44'),
(27, 'Lemo Cliff Graves', -3.042355, 119.877264, 'ChIJd07l-gPsky0ROZmLYepQjWc', 'https://picsum.photos/seed/gmtrip/640/400', NULL, '2025-11-11 13:05:45'),
(28, 'Batutumonga', -2.962843, 119.890434, 'ChIJ_RcB_MvDky0RxJrA7u7nXKI', 'https://picsum.photos/seed/gmtrip/640/400', NULL, '2025-11-11 13:05:45'),
(29, 'Bunaken Marine Park', 1.597430, 124.786604, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(30, 'Lake Linow', 1.275638, 124.826380, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(31, 'Tomohon Highlands', 1.370701, 124.833013, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(32, 'Piaynemo Viewpoint', -0.564861, 130.271020, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(33, 'Arborek Village', -0.508985, 130.508342, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(34, 'Friwen Wall', -0.471992, 130.690536, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(35, 'Derawan Island', 2.285212, 118.238992, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(36, 'Kakaban Lake', 2.140677, 118.509657, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(37, 'Sangalaki Island', 2.085917, 118.399488, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(38, 'Padar Island', -8.675257, 119.555411, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(39, 'Komodo Island', -8.568795, 119.501556, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(40, 'Pink Beach', -8.600180, 119.519923, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(41, 'Tanjung Tinggi Beach', -2.551729, 107.713730, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(42, 'Lengkuas Island', -2.536354, 107.619908, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(43, 'Kaolin Lake', -2.736663, 107.681995, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(44, 'Ijen Crater', -8.073674, 114.223317, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(45, 'Baluran National Park', -7.919969, 114.388345, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(46, 'Pulau Merah Beach', -8.589604, 114.016908, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(47, 'Parai Tenggiri Beach', -1.803866, 106.128576, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(48, 'Matras Beach', -1.797783, 106.119201, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(49, 'Pagoda Pantai Tikus', -1.899971, 106.185553, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(50, 'Bukit Batu Nature Reserve', -2.076700, 113.756400, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(51, 'Sebangau National Park', -2.296068, 113.896209, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(52, 'Palangka Raya Forest Trails', -2.294123, 113.903627, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(53, 'Ambon City', -3.694812, 128.107331, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(54, 'Ora Beach', -2.960571, 129.140000, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(55, 'Saleman Village', -2.962541, 129.119188, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(56, 'Wangi-Wangi', -5.358215, 123.556354, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(57, 'Hoga Island', -5.475679, 123.761157, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(58, 'Roma Dive Site', -5.764200, 123.930800, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(59, 'Lake Sentani', -2.596651, 140.622218, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(60, 'Asei Island', -5.776027, 123.894505, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(61, 'Cyclops Mountains', -2.562732, 140.600703, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(62, 'Tulamben - USAT Libertty Wreck', -8.275509, 115.592585, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(63, 'Amed - Jemeluk Bay', -8.338544, 115.660418, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(64, 'Nusa Penida - Manta Point', -8.682239, 115.488499, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(65, 'Padang Bai - Blue Lagoon', -8.529755, 115.510103, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(66, 'Eagle Square', 6.308462, 99.852105, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(67, 'Tanjung Rhu', 6.454462, 99.821627, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(68, 'Kilim Geoforest Park', 6.405041, 99.858250, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(69, 'Armenian Street', 5.415351, 100.337295, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(70, 'Kek Lok Si Temple', 5.399680, 100.273631, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(71, 'Penang Hill', 5.408485, 100.277341, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(72, 'Padang Besar Market', 6.662369, 100.324677, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(73, 'Wang Kelian Viewpoint', 6.665803, 100.201336, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(74, 'Gua Kelam', 6.643963, 100.205131, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(75, 'Concubine Lane', 4.596224, 101.078351, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(76, 'Kek Lok Tong Cave', 4.558864, 101.129312, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(77, 'Pangkor Island', 4.213544, 100.575946, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(78, 'Batu Caves', 3.237963, 101.684036, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(79, 'KLCC Park & Petronas', 3.155618, 101.714801, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(80, 'Putrajaya Bridges', 2.933219, 101.690282, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(81, 'Dutch Square', 2.194395, 102.248976, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(82, 'St. Paul’s Hill', 2.192734, 102.249586, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(83, 'Jonker Street', 2.195029, 102.248377, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(84, 'Teluk Kemang Beach', 2.453107, 101.855450, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(85, 'Cape Rachado Lighthouse', 2.407395, 101.850000, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(86, 'PD Waterfront', 2.522574, 101.803496, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(87, 'Desaru Beach', 1.547683, 104.262577, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(88, 'Adventure Waterpark', 1.538105, 104.261985, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(89, 'Kota Tinggi Fireflies', 1.727374, 103.911722, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(90, 'Sekinchan Paddy Fields', 3.512627, 101.140000, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(91, 'Sky Mirror', 3.342887, 101.250871, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(92, 'Firefly Park', 3.360696, 101.301549, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(93, 'Tea Plantations', 4.454178, 101.368807, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(94, 'Mossy Forest', 4.524309, 101.381944, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(95, 'Strawberry Farm', 4.495650, 101.387464, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(96, 'Canopy Walk', 5.428456, 100.265624, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(97, 'Jungle Trek', 4.643169, 102.427137, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(98, 'Night Safari', 1.402343, 103.791497, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(99, 'Tekek Village', 2.823073, 104.161069, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(100, 'Renggis Island', 2.810101, 104.135788, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(101, 'Juara Beach', 2.788799, 104.203617, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(102, 'Long Beach', 5.767854, 103.031131, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(103, 'Turtle Point', 5.902995, 102.741312, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(104, 'Romantic Beach', 5.923362, 102.717135, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(105, 'Pasir Panjang', 5.784443, 103.033934, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(106, 'Marine Park Centre', 5.746367, 103.000741, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(107, 'Turtle Bay', 5.785442, 103.020801, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(108, 'Siti Khadijah Market', 6.130185, 102.239229, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(109, 'Pantai Cahaya Bulan', 6.196300, 102.273611, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(110, 'Handicraft Village', 6.132269, 102.237661, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(111, 'Kinabalu Park', 6.005530, 116.542093, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(112, 'Desa Dairy Farm', 6.011719, 116.593344, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(113, 'Poring Hot Spring', 6.045767, 116.703349, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(114, 'Sipadan', 4.117408, 118.627929, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(115, 'Mabul', 4.242911, 118.631379, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(116, 'Kapalai', 4.226276, 118.683409, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(117, 'Sepilok Orangutan Centre', 5.865069, 117.948819, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(118, 'Labuk Bay', 5.924476, 117.811545, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(119, 'Kinabatangan River', 5.505296, 118.205789, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(120, 'Tip of Borneo', 7.036889, 116.742562, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(121, 'Tindakon Dazang Beach', 6.870380, 116.657773, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(122, 'Coconut Farms', 6.172222, 116.165354, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(123, 'Bako National Park', 1.663212, 110.431282, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(124, 'Kuching Waterfront', 1.560512, 110.345777, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(125, 'Semenggoh Wildlife Centre', 1.402046, 110.314490, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(126, 'Old City Temples', 18.788193, 98.995514, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(127, 'Doi Suthep', 18.816786, 98.891844, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(128, 'Doi Inthanon', 18.589262, 98.487490, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(129, 'Wat Rong Khun', 19.823428, 99.762676, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(130, 'Wat Rong Suea Ten', 19.923536, 99.841949, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(131, 'Baan Dam Museum', 19.992188, 99.860484, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(132, 'Pai Canyon', 19.306299, 98.452516, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(133, 'Tha Pai Hot Springs', 19.308156, 98.473149, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(134, 'Bamboo Bridge', 19.323969, 98.393815, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(135, 'Pha Taem NP', 15.398808, 105.507536, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(136, 'Sam Phan Bok', 15.794847, 105.401485, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(137, 'Wat Phu Prao', 15.148875, 105.467810, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(138, 'Grand Palace', 13.750543, 100.491239, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(139, 'Wat Arun', 13.744016, 100.488364, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(140, 'Ayutthaya Historical Park', 14.355824, 100.558702, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(141, 'Erawan Falls', 14.359841, 99.140819, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(142, 'Bridge on the River Kwai', 14.041527, 99.497415, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(143, 'Death Railway', 14.032620, 99.524794, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(144, 'Koh Larn', 12.922558, 100.789702, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(145, 'Sanctuary of Truth', 12.972909, 100.889165, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(146, 'Pattaya Viewpoint', 12.921753, 100.866514, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(147, 'Klong Plu Waterfall', 12.064743, 102.312784, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(148, 'Bang Bao Pier', 11.969174, 102.314618, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(149, 'Snorkel at Koh Rang', 11.798276, 102.391414, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(150, 'Phang Nga Bay', 8.061161, 98.433420, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(151, 'James Bond Island', 8.274446, 98.500667, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(152, 'Karon Viewpoint', 7.797551, 98.302524, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(153, 'Hong Island', 8.225370, 98.500528, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(154, 'Tiger Cave Temple', 8.314212, 98.930624, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(155, 'Emerald Pool', 7.925098, 99.268097, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(156, 'Ang Thong Marine Park', 9.635304, 99.671827, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(157, 'Chaweng Beach', 9.534068, 100.069211, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(158, 'Koh Phangan', 9.710852, 99.982419, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(159, 'Cheow Lan Lake', 8.974974, 98.809781, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(160, 'Caves & Trails', 8.986724, 98.602497, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(161, 'Viewpoints', 8.982877, 98.635295, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(162, 'Wat Nong Wang', 16.408291, 102.834308, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(163, 'Bueng Kaen Nakhon', 16.417364, 102.835031, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(164, 'Wat Thung Setthi', 16.448970, 102.893037, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(165, 'Pang Ung Lake', 19.498407, 97.909198, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(166, 'Mae Hong Son Town', 18.720075, 97.887593, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(167, 'Wat Phra That Doi Kong Mu', 19.300140, 97.960549, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(168, 'Koh Samet', 12.568857, 101.449434, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(169, 'Chanthaboon Old Town', 12.611558, 102.112549, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(170, 'Namtok Phlio', 12.527848, 102.179335, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(171, 'Lopburi Old Town', 15.050568, 100.890143, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(172, 'Sunflower Fields', 14.843248, 100.796701, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(173, 'Ayutthaya Park', 14.350916, 100.557093, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(174, 'Emerald Cave', 7.360360, 99.295125, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(175, 'Koh Muk', 7.378132, 99.310533, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(176, 'Koh Lipe', 6.486751, 99.303247, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(177, 'Wat Phra That Lampang Luang', 18.217379, 99.389360, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(178, 'Wat Chama Thewi', 18.581708, 98.996393, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(179, 'Ceramic Street', 18.291085, 99.497787, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(180, 'Phimai Historical Park', 15.220295, 102.494240, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(181, 'Wat Sala Loi', 14.980803, 102.116694, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(182, 'Khao Yai NP', 14.508341, 101.379440, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(183, 'Haew Narok Waterfall', 14.287301, 101.394138, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(184, 'Viewpoint Trail', 14.367003, 101.406043, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(185, 'Primo Piazza Khao Yai', 14.543226, 101.337125, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(187, 'Bromo Tengger Semeru National Park', -7.942780, 112.953330, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(188, 'Kawah Ijen', -8.058330, 114.242780, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(189, 'Semeru Mountain', -8.110000, 112.922780, NULL, NULL, NULL, '2025-11-11 10:24:31'),
(190, 'Sekumpul Waterfall', -8.238600, 115.168600, NULL, NULL, NULL, '2025-11-11 14:01:37'),
(191, 'Banyumala Twin Waterfalls', -8.263600, 115.102800, NULL, NULL, NULL, '2025-11-11 14:01:37'),
(192, 'Nungnung Waterfall', -8.391800, 115.236700, NULL, NULL, NULL, '2025-11-11 14:01:37'),
(193, 'Visit Tegenungan Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-14 15:05:12'),
(194, 'Explore Tukad Cepung Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-14 15:05:12'),
(195, 'Photography session', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-14 15:05:12'),
(196, 'Hike to Gitgit Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-14 15:05:12'),
(197, 'Swim in the natural pool', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-14 15:05:12'),
(198, 'Tegenungan Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-15 05:15:11'),
(199, 'Gitgit Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-15 05:15:11'),
(200, 'Mount Semeru', -8.107717, 112.922408, NULL, NULL, NULL, '2025-11-15 05:53:58'),
(201, 'Cikaniki Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-15 05:37:49'),
(202, 'Kawah Ijen Crater', -8.058381, 114.243299, NULL, NULL, NULL, '2025-11-15 05:53:58'),
(203, 'Cimahi Waterfall', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-15 05:41:25'),
(204, 'Cipanas Hot Springs', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-15 05:41:25'),
(205, 'Tumpak Sewa Waterfall', -7.090911, 107.668887, NULL, NULL, NULL, '2025-11-24 03:29:15'),
(206, 'Candi Borobudur', -7.536064, 112.238402, NULL, NULL, NULL, '2025-11-15 05:53:58'),
(207, 'Malang City', 0.000000, 0.000000, NULL, NULL, NULL, '2025-11-15 05:53:58'),
(208, 'Phi Phi Islands', 7.740738, 98.778410, NULL, NULL, NULL, '2025-11-16 07:05:41'),
(209, 'Freedom Beach', 7.875256, 98.275823, NULL, NULL, NULL, '2025-11-16 07:05:41'),
(210, 'Bang Tao Beach', 8.002546, 98.292632, NULL, NULL, NULL, '2025-11-16 07:05:41'),
(211, 'Racha Island', 7.603838, 98.366353, NULL, NULL, NULL, '2025-11-16 07:05:41'),
(212, 'Koh Yao Noi', 7.984311, 98.330747, NULL, NULL, NULL, '2025-11-16 07:05:41'),
(213, 'Patong Beach', 7.896576, 98.302104, NULL, NULL, NULL, '2025-11-16 07:31:17'),
(214, 'Koh Phi Phi', 7.984311, 98.330747, NULL, NULL, NULL, '2025-11-16 07:31:17'),
(215, 'Similan Islands', 8.657863, 97.646673, NULL, NULL, NULL, '2025-11-16 07:31:17'),
(216, 'Koh Racha', 7.603838, 98.366353, NULL, NULL, NULL, '2025-11-16 07:31:17'),
(217, 'Lake Toba', -7.003568, 107.589428, NULL, NULL, NULL, '2025-11-17 01:38:54'),
(218, 'Candi Prambanan', -7.090911, 107.668887, NULL, NULL, NULL, '2025-11-17 01:38:54'),
(219, 'Situ Patenggang Lake', -7.166965, 107.357534, NULL, NULL, NULL, '2025-11-17 01:38:54'),
(220, 'Pangandaran Beach', -7.687554, 108.638743, NULL, NULL, NULL, '2025-11-17 01:38:54'),
(221, 'Wat Phra Si Mahathat', 13.874257, 100.593438, NULL, NULL, NULL, '2025-11-17 01:46:36'),
(222, 'Wat Chao Prap', 14.342052, 100.555528, NULL, NULL, NULL, '2025-11-17 01:46:36'),
(223, 'Bang Pa-In Palace', 14.258558, 100.597136, NULL, NULL, NULL, '2025-11-17 01:46:36'),
(224, 'local market tour', 15.870032, 100.992541, NULL, NULL, NULL, '2025-11-17 01:46:36'),
(225, 'Cikaso Waterfall', -7.360475, 106.617578, NULL, NULL, NULL, '2025-11-24 03:29:15'),
(226, 'Curug Cimahi', -6.898519, 107.518947, NULL, NULL, NULL, '2025-11-24 03:29:15'),
(227, 'Nangka Waterfall', -6.669066, 106.726408, NULL, NULL, NULL, '2025-11-24 03:29:15'),
(228, 'Cibeureum Waterfall', -6.749822, 107.000799, NULL, NULL, NULL, '2025-11-24 03:29:15'),
(229, 'Kelimutu Lakes', -8.748933, 121.851530, NULL, NULL, NULL, '2025-12-07 05:38:25'),
(230, 'Bajawa Hot Springs', -8.785831, 120.975606, NULL, NULL, NULL, '2025-12-07 05:38:25'),
(231, 'Bena Village', -8.876744, 120.985898, NULL, NULL, NULL, '2025-12-07 05:38:25');

-- --------------------------------------------------------

--
-- Table structure for table `poi_candidates`
--

CREATE TABLE `poi_candidates` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `country` varchar(80) NOT NULL,
  `region` varchar(120) NOT NULL,
  `name` varchar(200) NOT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `confidence` tinyint(4) DEFAULT NULL,
  `matched_point_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` enum('new','matched','dismissed') NOT NULL DEFAULT 'new',
  `source` enum('ai','user') NOT NULL DEFAULT 'ai',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `poi_candidates`
--

INSERT INTO `poi_candidates` (`id`, `country`, `region`, `name`, `lat`, `lng`, `confidence`, `matched_point_id`, `status`, `source`, `created_at`) VALUES
(1, 'Indonesia', 'Bali', 'Ubud', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 04:59:47'),
(2, 'Indonesia', 'Bali', 'Seminyak', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 04:59:47'),
(3, 'Indonesia', 'Bali', 'Canggu', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 04:59:47'),
(4, 'Indonesia', 'Bali', 'Nusa Dua', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 04:59:47'),
(5, 'Indonesia', 'Bali', 'Kuta', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 04:59:47'),
(6, 'Thailand', 'Chiang Mai', 'Old City', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 05:12:30'),
(7, 'Thailand', 'Chiang Mai', 'Doi Suthep', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 05:12:30'),
(8, 'Thailand', 'Chiang Mai', 'Night Bazaar', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 05:12:30'),
(9, 'Thailand', 'Chiang Mai', 'Elephant Sanctuary', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 05:12:30'),
(10, 'Thailand', 'Chiang Mai', 'Chiang Mai Zoo', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 05:12:30'),
(11, 'Malaysia', 'Johor', 'Legoland Malaysia', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 10:26:02'),
(12, 'Malaysia', 'Johor', 'Johor Bahru', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 10:26:02'),
(13, 'Malaysia', 'Johor', 'Desaru Beach', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-07 10:26:02'),
(14, 'Indonesia', 'Bali', 'Ubud', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-08 08:34:52'),
(15, 'Indonesia', 'Bali', 'Seminyak', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-08 08:34:52'),
(16, 'Indonesia', 'Bali', 'Uluwatu', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-08 08:34:52'),
(17, 'Indonesia', 'Bali', 'Nusa Penida', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-08 08:34:52'),
(18, 'Indonesia', 'Bali', 'Canggu', NULL, NULL, NULL, NULL, 'new', 'ai', '2025-10-08 08:34:52');

-- --------------------------------------------------------

--
-- Table structure for table `trips`
--

CREATE TABLE `trips` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(150) NOT NULL,
  `country` varchar(50) NOT NULL,
  `province` varchar(100) DEFAULT NULL,
  `region` varchar(100) NOT NULL,
  `best_season` varchar(50) DEFAULT NULL,
  `suggested_duration` varchar(20) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `itinerary` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `source` enum('manual','ai') NOT NULL DEFAULT 'manual',
  `curation_status` enum('published','needs_review','rejected') NOT NULL DEFAULT 'published',
  `ai_model` varchar(64) DEFAULT NULL,
  `ai_prompt_sig` char(64) DEFAULT NULL,
  `quality_score` tinyint(4) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `trips`
--

INSERT INTO `trips` (`id`, `title`, `country`, `province`, `region`, `best_season`, `suggested_duration`, `notes`, `itinerary`, `created_at`, `source`, `curation_status`, `ai_model`, `ai_prompt_sig`, `quality_score`, `updated_at`) VALUES
(1, 'West Sumatra Highlands Adventure', 'Indonesia', 'Sumatra', 'West Sumatra', 'May – September', '2 days 1 night', 'Base in Bukittinggi. Private car or motorbike recommended. Roads are winding.', 'Bukittinggi, Sianok Canyon, Lake Maninjau (Kelok 44)', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(2, 'Lake Toba Explorer', 'Indonesia', 'Sumatra', 'North Sumatra', 'June – September', '3 days 2 nights', 'Include ferry crossings. Distances around the lake are longer than they look.', 'Parapat, Samosir Island, Holbung Hill, Sipiso-piso Waterfall', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(3, 'Aceh Hidden Paradise', 'Indonesia', 'Sumatra', 'Aceh', 'December – March', '2 days 1 night', 'Base in Banda Aceh or Lhoknga. Use private car; distances add up.', 'Lampuuk Beach, Mount Seulawah Agam, Jantho Forest Reserve', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(4, 'East Java Adventure Circuit', 'Indonesia', 'Java', 'East Java', 'May – September', '3 days 2 nights', 'Base in Malang. Start Bromo at dawn; Tumpak Sewu paths are wet and steep. Private car best.', 'Mount Bromo, Tumpak Sewu Waterfall, Malang Old Town', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(5, 'Yogyakarta Heritage & Volcano', 'Indonesia', 'Java', 'Yogyakarta', 'May – September', '2 days 1 night', 'Base in Yogyakarta City. Buy temple tickets ahead; start early.', 'Borobudur Temple, Prambanan Temple, Merapi Kaliurang', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(6, 'Dieng Highlands Escape', 'Indonesia', 'Java', 'Central Java', 'June – September', '2 days 1 night', 'Base in Wonosobo. Cool weather; roads winding.', 'Sikunir Sunrise, Telaga Warna, Sikidang Crater', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(7, 'Ubud Terraces & Waterfalls', 'Indonesia', 'Bali', 'Bali', 'May – September', '2 days 1 night', 'Base in Ubud. Narrow roads and parking; start early.', 'Tegallalang Rice Terrace, Tukad Cepung Waterfall, Mount Batur Viewpoint', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(8, 'Lombok North & Gili', 'Indonesia', 'West Nusa Tenggara', 'Lombok', 'April – October', '3 days 2 nights', 'Base in Senggigi. Waterfalls need short hikes; boat to Gili from Bangsal.', 'Sendang Gile & Tiu Kelep, Malimbu Hill, Gili Air', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(9, 'Tana Toraja Heritage Trail', 'Indonesia', 'Sulawesi', 'Tana Toraja', 'June – September', '3 days 2 nights', 'Base in Rantepao. Mountain roads are slow; rituals follow local schedules.', 'Kete Kesu, Lemo Cliff Graves, Batutumonga', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(10, 'Manado—Bunaken & Highlands', 'Indonesia', 'Sulawesi', 'Manado & Minahasa', 'June – October', '3 days 2 nights', 'Base in Manado. Arrange boat to Bunaken; marine park fee applies.', 'Bunaken Marine Park, Lake Linow, Tomohon Highlands', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(11, 'Raja Ampat Gateway', 'Indonesia', 'Papua', 'Raja Ampat', 'October – April', '3 days 2 nights', 'Base in Waisai or Arborek. Speedboat for island-hopping; avoid June–August.', 'Piaynemo Viewpoint, Arborek Village, Friwen Wall', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(12, 'Derawan Islands Discovery', 'Indonesia', 'Kalimantan', 'East Kalimantan', 'May – September', '3 days 2 nights', 'Base in Derawan. Arrange boats to Sangalaki and Kakaban.', 'Derawan Island, Kakaban Lake, Sangalaki Island', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(13, 'Komodo National Park Cruise', 'Indonesia', 'Nusa Tenggara', 'Flores', 'April – November', '3 days 2 nights', 'Base in Labuan Bajo. Join liveaboard/day trip; dragon trekking with guide only.', 'Padar Island, Komodo Island, Pink Beach', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(14, 'Belitung Island Highlights', 'Indonesia', 'Sumatra', 'Belitung', 'April – October', '2 days 1 night', 'Base in Tanjung Pandan. Short boat hops; check afternoon tides.', 'Tanjung Tinggi Beach, Lengkuas Island, Kaolin Lake', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(15, 'Banyuwangi Natural Wonders', 'Indonesia', 'Java', 'East Java', 'May – September', '3 days 2 nights', 'Base in Banyuwangi City. Start Ijen before dawn.', 'Ijen Crater, Baluran National Park, Pulau Merah Beach', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(16, 'Bangka Island Coastal Trail', 'Indonesia', 'Sumatra', 'Bangka Belitung', 'May – September', '2 days 1 night', 'Base in Pangkalpinang. Consider rented car/motorbike.', 'Parai Tenggiri Beach, Matras Beach, Pagoda Pantai Tikus', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(17, 'Sebangau Jungle & Bukit Batu Offroad', 'Indonesia', 'Kalimantan', 'Central Kalimantan', 'June – September', '3 days 2 nights', 'Use a 4x4 or motorbike ride to Bukit Batu Nature Reserve.', 'Bukit Batu Nature Reserve, Sebangau National Park, Palangka Raya Forest Trails', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 07:58:33'),
(18, 'Ambon & Ora Beach Escape', 'Indonesia', 'Maluku', 'Central Maluku', 'October – March', '4 days 3 nights', 'Base in Ambon and Sawai. Ferry + long drive needed to reach Ora.', 'Ambon City, Ora Beach, Saleman Village', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(19, 'Wakatobi Marine Adventure', 'Indonesia', 'Sulawesi', 'Southeast Sulawesi', 'April – November', '3 days 2 nights', 'Base in Wangi-Wangi. Coordinate dives; transport not daily.', 'Wangi-Wangi, Hoga Island, Roma Dive Site', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-26 10:22:25'),
(20, 'Lake Sentani & Cyclops Range', 'Indonesia', 'Papua', 'Jayapura', 'June – October', '2 days 1 night', 'Base in Jayapura. Light hikes and boat transfers.', 'Lake Sentani, Asei Island, Cyclops Mountains', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:41:09'),
(21, 'Bali Dive & Snorkel Explorer', 'Indonesia', 'Bali', 'Bali', 'May – November', '3 days 2 nights', 'Use licensed dive operators. Currents around Nusa Penida can be strong—always check daily conditions. Depart early for boat transfers.', 'Tulamben – USAT Liberty Wreck, Amed – Jemeluk Bay Snorkeling, Nusa Penida – Manta Point & Crystal Bay, Padang Bai – Blue Lagoon & Tanjung Jepun', '2025-10-07 02:21:26', 'manual', 'published', NULL, NULL, NULL, '2025-10-26 10:01:49'),
(22, 'Langkawi Highlights', 'Malaysia', 'Northern Peninsula', 'Kedah (Langkawi)', 'December – March; June – August', '3 days 2 nights', 'Base in Pantai Cenang. Boat timings depend on tide/wind.', 'Eagle Square, Tanjung Rhu, Kilim Geoforest Park', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(23, 'Penang Heritage Highlights', 'Malaysia', 'Northern Peninsula', 'Penang (George Town)', 'Year-round (drier Dec–Mar)', '2 days 1 night', 'Base in George Town. Walk/bike for heritage core.', 'Armenian Street, Kek Lok Si Temple, Penang Hill', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(24, 'Perlis Borderlands Discovery', 'Malaysia', 'Northern Peninsula', 'Perlis (Padang Besar & Wang Kelian)', 'December – March; June – August', '2 days 1 night', 'Base in Kangar. Border market hours vary.', 'Padang Besar Market, Wang Kelian Viewpoint, Gua Kelam', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(25, 'Ipoh & Pangkor Coast Escape', 'Malaysia', 'Central–South Peninsula', 'Perak (Ipoh & Pangkor)', 'June – September (drier)', '3 days 2 nights', 'Base in Ipoh. Reserve ferry to Pangkor.', 'Concubine Lane, Kek Lok Tong Cave, Pangkor Island', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(26, 'Kuala Lumpur & Putrajaya Highlights', 'Malaysia', 'Central–South Peninsula', 'Selangor & Kuala Lumpur', 'Year-round (heavier rain Nov–Jan)', '2 days 1 night', 'Base in Kuala Lumpur. Cluster sights; use rail/ride-hailing.', 'Batu Caves, KLCC Park & Petronas, Putrajaya Bridges', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(27, 'Melaka Heritage City Break', 'Malaysia', 'Central–South Peninsula', 'Malacca (Melaka City)', 'Year-round (avoid midday heat)', '2 days 1 night', 'Base near Jonker Street. Avoid weekend crowds.', 'Dutch Square, St. Paul’s Hill, Jonker Street', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(28, 'Port Dickson Beach Getaway', 'Malaysia', 'Central–South Peninsula', 'Negeri Sembilan (Port Dickson)', 'Year-round (heavier rain Nov–Jan)', '2 days 1 night', 'Base near Teluk Kemang. Weekend traffic heavier.', 'Teluk Kemang Beach, Cape Rachado Lighthouse, PD Waterfront', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:13:21'),
(29, 'Desaru Coast & Fireflies', 'Malaysia', 'Central–South Peninsula', 'Johor (Desaru Coast)', 'March – October', '2 days 1 night', 'Base in Desaru. Book firefly/river cruise early.', 'Desaru Beach, Adventure Waterpark, Kota Tinggi Fireflies', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:06'),
(30, 'Sekinchan Paddy & Sky Mirror', 'Malaysia', 'Central–South Peninsula', 'Selangor (Kuala Selangor & Sekinchan)', 'Year-round (golden paddy Jun–Aug)', '2 days 1 night', 'Base in Sekinchan/Kuala Selangor. Night fireflies are weather dependent.', 'Sekinchan Paddy Fields, Sky Mirror, Firefly Park', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(31, 'Cameron Highlands Nature Retreat', 'Malaysia', 'East Coast Peninsula', 'Pahang (Cameron Highlands)', 'March – September', '2 days 1 night', 'Base in Tanah Rata. Cool climate; weekend traffic.', 'Tea Plantations, Mossy Forest, Strawberry Farm', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:16:36'),
(32, 'Taman Negara Rainforest Classic', 'Malaysia', 'East Coast Peninsula', 'Pahang (Taman Negara)', 'March – September', '3 days 2 nights', 'Base in Kuala Tahan. Boat transfers required.', 'Canopy Walk, Jungle Trek, Night Safari', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(33, 'Tioman Island Highlights', 'Malaysia', 'East Coast Peninsula', 'Pahang (Tioman Island)', 'March – October', '3 days 2 nights', 'Base in Tekek/ABC. Boats via Mersing/Tanjung Gemok.', 'Tekek Village, Renggis Island, Juara Beach', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(34, 'Perhentian Islands Highlights', 'Malaysia', 'East Coast Peninsula', 'Terengganu (Perhentian Islands)', 'April – October', '3 days 2 nights', 'Base on Kecil/Besar. Monsoon closures Nov–Mar.', 'Long Beach, Turtle Point, Romantic Beach', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(35, 'Redang Island Highlights', 'Malaysia', 'East Coast Peninsula', 'Terengganu (Redang Island)', 'April – October', '3 days 2 nights', 'Base in Redang resorts. Boats depend on sea state.', 'Pasir Panjang, Marine Park Centre, Turtle Bay', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(36, 'Kelantan Culture & Coast', 'Malaysia', 'East Coast Peninsula', 'Kelantan (Kota Bharu & Coast)', 'March – September', '2 days 1 night', 'Base in Kota Bharu. Markets and mosques observe prayer times.', 'Siti Khadijah Market, Pantai Cahaya Bulan, Handicraft Village', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(37, 'Kinabalu Park & Highlands', 'Malaysia', 'Sabah (Borneo)', 'Kota Kinabalu & Kinabalu Park', 'February – August', '3 days 2 nights', 'Base in Kota Kinabalu. Book park entry early; weather shifts fast.', 'Kinabalu Park, Desa Dairy Farm, Poring Hot Spring', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(38, 'Semporna Archipelago Highlights', 'Malaysia', 'Sabah (Borneo)', 'Semporna Archipelago', 'March – October', '3 days 2 nights', 'Base in Semporna/Mabul. Sipadan permits limited.', 'Sipadan, Mabul, Kapalai', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(39, 'Sandakan & Kinabatangan Wildlife', 'Malaysia', 'Sabah (Borneo)', 'Sandakan & Sepilok', 'March – October', '3 days 2 nights', 'Base in Sandakan. Check feeding times & river cruise slots.', 'Sepilok Orangutan Centre, Labuk Bay, Kinabatangan River', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(40, 'Tip of Borneo (Kudat) Highlights', 'Malaysia', 'Sabah (Borneo)', 'Kudat (Tip of Borneo)', 'February – August', '2 days 1 night', 'Base in Kudat. Long drive from KK; start early.', 'Tip of Borneo, Tindakon Dazang Beach, Coconut Farms', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(41, 'Kuching & Bako Wildlife', 'Malaysia', 'Sarawak (Borneo)', 'Kuching & Bako', 'June – September (drier)', '2 days 1 night', 'Base in Kuching. Bako boats depend on tide; start early.', 'Bako National Park, Kuching Waterfront, Semenggoh Wildlife Centre', '2025-10-07 02:27:52', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:26:07'),
(42, 'Chiang Mai Peaks & Temples', 'Thailand', 'Northern Thailand', 'Chiang Mai (Old Town & Doi Suthep)', 'November – February (cool & dry)', '3 days 2 nights', 'Base in Chiang Mai Old Town. Visit temples early; mountain roads winding.', 'Old City Temples, Doi Suthep, Doi Inthanon', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-20 03:51:16'),
(43, 'Chiang Rai Temples Loop', 'Thailand', 'Northern Thailand', 'Chiang Rai & Golden Triangle', 'November – February (cool & dry)', '2 days 1 night', 'Base in Chiang Rai. Combine White, Blue, and Black temples in one loop.', 'Wat Rong Khun, Wat Rong Suea Ten, Baan Dam Museum', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:27:06'),
(44, 'Pai Scenic Loop', 'Thailand', 'Northern Thailand', 'Pai (Mae Hong Son Loop)', 'November – February', '2 days 1 night', 'Base in Pai Town. Scenic drive; allow stops for viewpoints.', 'Pai Canyon, Tha Pai Hot Springs, Bamboo Bridge', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:27:06'),
(45, 'Ubon Mekong Cliff Adventure', 'Thailand', 'Northeastern Thailand (Isan)', 'Ubon Ratchathani & Mekong Cliffs', 'November – March (dry)', '3 days 2 nights', 'Base in Ubon. Visit canyons and riverside temples early for cooler temps.', 'Pha Taem NP, Sam Phan Bok, Wat Phu Prao', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:27:06'),
(46, 'Bangkok & Ayutthaya Heritage Trail', 'Thailand', 'Central Thailand', 'Central Thailand', 'November – February (dry)', '3 days 2 nights', 'Base in Bangkok. Use BTS and river boats; visit Ayutthaya early to avoid heat.', 'Grand Palace, Wat Arun, Ayutthaya Historical Park', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:47:57'),
(47, 'Kanchanaburi Highlights', 'Thailand', 'Central Thailand', 'Western Thailand', 'November – February (cool & dry)', '2 days 1 night', 'Base in Kanchanaburi Town. Start Erawan early; avoid holiday crowds.', 'Erawan Falls, Bridge on the River Kwai, Death Railway', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:47:58'),
(48, 'Pattaya Seaside Escape', 'Thailand', 'Eastern Thailand', 'Eastern Thailand', 'November – April (dry)', '2 days 1 night', 'Base in Pattaya. Ferries to Koh Larn frequent; avoid weekends.', 'Koh Larn, Sanctuary of Truth, Pattaya Viewpoint', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:47:58'),
(49, 'Koh Chang Island Discovery', 'Thailand', 'Eastern Thailand', 'Eastern Thailand', 'November – April (dry)', '3 days 2 nights', 'Base in White Sand or Klong Prao. Steep roads; check boat schedule.', 'Klong Plu Waterfall, Bang Bao Pier, Snorkel at Koh Rang', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:47:58'),
(50, 'Phuket & Phang Nga Bay Adventure', 'Thailand', 'Southern Thailand', 'Southern Thailand', 'November – April (dry)', '3 days 2 nights', 'tours may be cancelled during monsoon (May–October). Most tours start early from Ao Por Pier', 'Phang Nga Bay, James Bond Island, Karon Viewpoint', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 08:47:58'),
(51, 'Krabi Cliffs & Emerald Pools', 'Thailand', 'Southern Thailand', 'Krabi (Ao Nang & Islands)', 'November – April (dry)', '3 days 2 nights', 'Base in Ao Nang. Choose one island-hopping day and inland sights.', 'Hong Island, Tiger Cave Temple, Emerald Pool', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:10'),
(52, 'Samui–Phangan–Tao Island Loop', 'Thailand', 'Southern Thailand', 'Gulf (Samui, Phangan, Tao)', 'January – August (calm seas)', '3 days 2 nights', 'Base in Koh Samui. Ferries connect Phangan & Tao; book ahead.', 'Ang Thong Marine Park, Chaweng Beach, Koh Phangan', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(53, 'Khao Sok Jungle & Lake Adventure', 'Thailand', 'Southern Thailand', 'Surat Thani (Khao Sok National Park)', 'December – April (drier)', '2 days 1 night', 'Base near Cheow Lan Lake. Book long-tail cruise and floating house early.', 'Cheow Lan Lake, Caves & Trails, Viewpoints', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(54, 'Khon Kaen City & Temples', 'Thailand', 'Northeastern Thailand (Isan)', 'Khon Kaen & Temples', 'November – March (cool)', '2 days 1 night', 'Base in Khon Kaen. Visit city temples and lake parks.', 'Wat Nong Wang, Bueng Kaen Nakhon, Wat Thung Setthi', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(55, 'Mae Hong Son Lake & Hill Temple', 'Thailand', 'Northern Thailand', 'Mae Hong Son Loop', 'November – February (cool)', '3 days 2 nights', 'Base in Pai or Mae Hong Son. Roads winding but scenic.', 'Pang Ung Lake, Mae Hong Son Town, Wat Phra That Doi Kong Mu', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(56, 'Rayong–Chanthaburi Coastal Loop', 'Thailand', 'Eastern Thailand', 'Rayong & Chanthaburi', 'November – April (dry)', '3 days 2 nights', 'Base in Rayong. Visit fruit orchards & Chanthaboon riverside.', 'Koh Samet, Chanthaboon Old Town, Namtok Phlio', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(57, 'Lopburi & Ayutthaya Heritage Drive', 'Thailand', 'Central Thailand', 'Lopburi & Ayutthaya', 'November – February (dry)', '2 days 1 night', 'Base in Lopburi. Combine sunflower fields & historic ruins.', 'Lopburi Old Town, Sunflower Fields, Ayutthaya Park', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(58, 'Trang & Lipe Island Hopping', 'Thailand', 'Southern Thailand', 'Trang & Koh Lipe', 'November – April (dry)', '3 days 2 nights', 'Base in Trang Town or Lipe. Ferry times depend on tide.', 'Emerald Cave, Koh Muk, Koh Lipe', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(59, 'Lampang–Lamphun Heritage Trail', 'Thailand', 'Northern Thailand', 'Lampang & Lamphun', 'November – February (cool)', '2 days 1 night', 'Base in Lampang. Small-town pace; visit temples by horse cart.', 'Wat Phra That Lampang Luang, Wat Chama Thewi, Ceramic Street', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(60, 'Korat Heritage & Khao Yai Day Trip', 'Thailand', 'Northeastern Thailand (Isan)', 'Nakhon Ratchasima (Korat)', 'November – March (dry)', '2 days 1 night', 'Base in Korat City. Explore historical parks nearby.', 'Phimai Historical Park, Wat Sala Loi, Khao Yai NP', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(61, 'Khao Yai Nature & Cultural Escape', 'Thailand', 'Central Thailand', 'Khao Yai National Park', 'November – February (cool)', '2 days 1 night', 'Base in Pak Chong. Trails may close during heavy rain; start early for Haew Narok and Pha Diew Dai viewpoint.', 'Haew Narok Waterfall, Viewpoint Trail (Pha Diew Dai), Primo Piazza Khao Yai', '2025-10-07 02:36:51', 'manual', 'published', NULL, NULL, NULL, '2025-10-27 09:14:11'),
(144, 'Bali Waterfall Exploration', 'Indonesia', 'Bali', 'Bali', NULL, NULL, '', 'Check into hotel, Relax at the beach, Visit Tukad Cepung Waterfall, Enjoy natural beauty, Hike to Nungnung Waterfall, Picnic nearby, Swim at Kanto Lampo, Explore surroundings, Explore Ubud, Head to the airport', '2025-11-13 15:52:12', 'ai', 'published', 'gpt-4o-mini', 'trips_ai_save_auto_v1', 1, '2025-11-13 15:52:12'),
(145, 'Bali Waterfall Adventure', 'Indonesia', 'Bali', 'Bali', '', '', 'A perfect blend of relaxation and adventure.', 'Visit Tegenungan Waterfall, Explore Tukad Cepung Waterfall, Photography session, Hike to Gitgit Waterfall, Swim in the natural pool', '2025-11-14 15:05:12', 'ai', 'published', NULL, NULL, NULL, '2025-11-14 15:05:12'),
(146, 'Bali Waterfall Adventure', 'Indonesia', 'Bali', 'Bali', '', '', 'Explore stunning waterfalls in Bali.', 'Tegenungan Waterfall, Gitgit Waterfall, Sekumpul Waterfall, Nungnung Waterfall, Tukad Cepung Waterfall', '2025-11-15 05:15:11', 'ai', 'published', NULL, NULL, NULL, '2025-11-15 05:15:11'),
(147, 'Java Hiking Adventure', 'Indonesia', 'Java', 'Java', '', '', 'Explore Java\'s stunning landscapes and hikes.', 'Mount Semeru, Bromo Tengger Semeru National Park, Cikaniki Waterfall, Kawah Ijen Crater', '2025-11-15 05:37:49', 'ai', 'published', NULL, NULL, NULL, '2025-11-15 05:37:49'),
(148, 'Java Hiking Adventure', 'Indonesia', 'Java', 'Java', '', '', 'Explore Java\'s stunning natural landscapes.', 'Mount Semeru, Bromo Tengger Semeru National Park, Cimahi Waterfall, Cipanas Hot Springs', '2025-11-15 05:41:25', 'ai', 'published', NULL, NULL, NULL, '2025-11-15 05:41:25'),
(154, 'Java Waterfall Adventure', 'Indonesia', 'West Java', 'West Java', '', '', 'Explore stunning waterfalls in Java.', 'Cikaso Waterfall, Curug Cimahi, Tumpak Sewa Waterfall, Nangka Waterfall, Cibeureum Waterfall', '2025-11-24 03:29:15', 'ai', 'published', NULL, NULL, NULL, '2025-11-24 03:29:15'),
(155, 'Adventure in Flores', 'Indonesia', 'Nusa Tenggara', 'Nusa Tenggara', 'May to September', '2 days', 'Perfect for nature lovers and those interested in local traditions.', 'Kelimutu Lakes, Bajawa Hot Springs, Bena Village', '2025-12-07 05:38:25', 'ai', 'published', NULL, NULL, NULL, '2025-12-07 05:38:25');

-- --------------------------------------------------------

--
-- Table structure for table `trip_points`
--

CREATE TABLE `trip_points` (
  `trip_id` bigint(20) UNSIGNED NOT NULL,
  `point_id` bigint(20) UNSIGNED NOT NULL,
  `day` tinyint(3) UNSIGNED NOT NULL DEFAULT 1,
  `seq` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `trip_points`
--

INSERT INTO `trip_points` (`trip_id`, `point_id`, `day`, `seq`) VALUES
(1, 1, 1, 1),
(1, 2, 1, 2),
(1, 3, 1, 3),
(2, 4, 1, 1),
(2, 5, 1, 2),
(2, 6, 1, 3),
(2, 7, 1, 4),
(3, 8, 1, 1),
(3, 9, 1, 2),
(3, 10, 1, 3),
(4, 11, 1, 1),
(4, 12, 1, 2),
(4, 13, 1, 3),
(5, 14, 1, 1),
(5, 15, 1, 2),
(5, 16, 1, 3),
(6, 17, 1, 1),
(6, 18, 1, 2),
(6, 19, 1, 3),
(7, 20, 1, 1),
(7, 21, 1, 2),
(144, 21, 2, 1),
(146, 21, 1, 5),
(7, 22, 1, 3),
(8, 23, 1, 1),
(8, 24, 1, 2),
(8, 25, 1, 3),
(9, 26, 1, 1),
(9, 27, 1, 2),
(9, 28, 1, 3),
(10, 29, 1, 1),
(10, 30, 1, 2),
(10, 31, 1, 3),
(11, 32, 1, 1),
(11, 33, 1, 2),
(11, 34, 1, 3),
(12, 35, 1, 1),
(12, 36, 1, 2),
(12, 37, 1, 3),
(13, 38, 1, 1),
(13, 39, 1, 2),
(13, 40, 1, 3),
(14, 41, 1, 1),
(14, 42, 1, 2),
(14, 43, 1, 3),
(15, 44, 1, 1),
(15, 45, 1, 2),
(15, 46, 1, 3),
(16, 47, 1, 1),
(16, 48, 1, 2),
(16, 49, 1, 3),
(17, 50, 1, 1),
(17, 51, 1, 2),
(17, 52, 1, 3),
(18, 53, 1, 1),
(18, 54, 1, 2),
(18, 55, 1, 3),
(19, 56, 1, 1),
(19, 57, 1, 2),
(19, 58, 1, 3),
(20, 59, 1, 1),
(20, 60, 1, 2),
(20, 61, 1, 3),
(21, 62, 1, 1),
(21, 63, 1, 2),
(21, 64, 1, 3),
(21, 65, 1, 4),
(22, 66, 1, 1),
(22, 67, 1, 2),
(22, 68, 1, 3),
(23, 69, 1, 1),
(23, 70, 1, 2),
(23, 71, 1, 3),
(24, 72, 1, 1),
(24, 73, 1, 2),
(24, 74, 1, 3),
(25, 75, 1, 1),
(25, 76, 1, 2),
(25, 77, 1, 3),
(26, 78, 1, 1),
(26, 79, 1, 2),
(26, 80, 1, 3),
(27, 81, 1, 1),
(27, 82, 1, 2),
(27, 83, 1, 3),
(28, 84, 1, 1),
(28, 85, 1, 2),
(28, 86, 1, 3),
(29, 87, 1, 1),
(29, 88, 1, 2),
(29, 89, 1, 3),
(30, 90, 1, 1),
(30, 91, 1, 2),
(30, 92, 1, 3),
(31, 93, 1, 1),
(31, 94, 1, 2),
(31, 95, 1, 3),
(32, 96, 1, 1),
(32, 97, 1, 2),
(32, 98, 1, 3),
(33, 99, 1, 1),
(33, 100, 1, 2),
(33, 101, 1, 3),
(34, 102, 1, 1),
(34, 103, 1, 2),
(34, 104, 1, 3),
(35, 105, 1, 1),
(35, 106, 1, 2),
(35, 107, 1, 3),
(36, 108, 1, 1),
(36, 109, 1, 2),
(36, 110, 1, 3),
(37, 111, 1, 1),
(37, 112, 1, 2),
(37, 113, 1, 3),
(38, 114, 1, 1),
(38, 115, 1, 2),
(38, 116, 1, 3),
(39, 117, 1, 1),
(39, 118, 1, 2),
(39, 119, 1, 3),
(40, 120, 1, 1),
(40, 121, 1, 2),
(40, 122, 1, 3),
(41, 123, 1, 1),
(41, 124, 1, 2),
(41, 125, 1, 3),
(42, 126, 1, 1),
(42, 127, 1, 2),
(42, 128, 1, 3),
(43, 129, 1, 1),
(43, 130, 1, 2),
(43, 131, 1, 3),
(44, 132, 1, 1),
(44, 133, 1, 2),
(44, 134, 1, 3),
(45, 135, 1, 1),
(45, 136, 1, 2),
(45, 137, 1, 3),
(46, 138, 1, 1),
(46, 139, 1, 2),
(46, 140, 1, 3),
(47, 141, 1, 1),
(47, 142, 1, 2),
(47, 143, 1, 3),
(48, 144, 1, 1),
(48, 145, 1, 2),
(48, 146, 1, 3),
(49, 147, 1, 1),
(49, 148, 1, 2),
(49, 149, 1, 3),
(50, 150, 1, 1),
(50, 151, 1, 2),
(50, 152, 1, 3),
(51, 153, 1, 1),
(51, 154, 1, 2),
(51, 155, 1, 3),
(52, 156, 1, 1),
(52, 157, 1, 2),
(144, 157, 1, 1),
(52, 158, 1, 3),
(53, 159, 1, 1),
(53, 160, 1, 2),
(53, 161, 1, 3),
(54, 162, 1, 1),
(54, 163, 1, 2),
(54, 164, 1, 3),
(55, 165, 1, 1),
(55, 166, 1, 2),
(55, 167, 1, 3),
(56, 168, 1, 1),
(56, 169, 1, 2),
(56, 170, 1, 3),
(57, 171, 1, 1),
(57, 172, 1, 2),
(57, 173, 1, 3),
(58, 174, 1, 1),
(58, 175, 1, 2),
(58, 176, 1, 3),
(59, 177, 1, 1),
(59, 178, 1, 2),
(59, 179, 1, 3),
(60, 180, 1, 1),
(60, 181, 1, 2),
(60, 182, 1, 3),
(61, 183, 1, 1),
(61, 184, 1, 2),
(61, 185, 1, 3),
(147, 187, 1, 2),
(148, 187, 1, 2),
(146, 190, 1, 3),
(144, 192, 3, 1),
(146, 192, 1, 4),
(145, 193, 1, 1),
(145, 194, 1, 2),
(145, 195, 1, 3),
(145, 196, 1, 4),
(145, 197, 1, 5),
(146, 198, 1, 1),
(146, 199, 1, 2),
(147, 200, 1, 1),
(148, 200, 1, 1),
(147, 201, 1, 3),
(147, 202, 1, 4),
(148, 203, 1, 3),
(148, 204, 1, 4),
(154, 205, 1, 3),
(154, 225, 1, 1),
(154, 226, 1, 2),
(154, 227, 1, 4),
(154, 228, 1, 5),
(155, 229, 1, 1),
(155, 230, 1, 2),
(155, 231, 1, 3);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(190) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `email`, `password_hash`, `full_name`, `created_at`) VALUES
(1, 'calistaileen', 'calistasiktiawan@gmail.com', 'scrypt:32768:8:1$C27jRS0koR2jbfx9$3bacbe9425b928d148416fd068e16faeae2901418e16ecd0d1001e6e0a94e204cffe62d3b7a26c212d8290b22dcffc328493191a708721b0033952ffc7a33b3d', '', '2025-10-08 15:10:28'),
(3, 'Tester01', '123456@gmail.com', 'scrypt:32768:8:1$UiekGFp5bNlh8P76$b746c30badd2a4100c4681765ea079e2334e6fce5d04633f7d245ee2c0142481f78b4373325ff355c125b5eb105f08947e6288936fa91901a26dca98d3dbf155', 'Teater Chen', '2025-10-27 12:26:18');

-- --------------------------------------------------------

--
-- Table structure for table `user_trips`
--

CREATE TABLE `user_trips` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `user_token` varchar(64) NOT NULL,
  `title` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `notes` text DEFAULT NULL,
  `rating` tinyint(3) UNSIGNED DEFAULT NULL,
  `review` text DEFAULT NULL,
  `photo_url` varchar(255) DEFAULT NULL,
  `country` varchar(50) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `base_trip_id` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_trips`
--

INSERT INTO `user_trips` (`id`, `user_id`, `user_token`, `title`, `notes`, `rating`, `review`, `photo_url`, `country`, `region`, `base_trip_id`, `created_at`, `updated_at`) VALUES
(9, 3, 'f3c8fc1b-94db-481c-b97d-f2b0d58d3c78', 'Test Save 01', '{\"title\": \"Test Save 01\", \"notes\": null, \"stops\": [{\"name\": \"Mega Pontoon Quick Silver\", \"lat\": -8.6814816, \"lng\": 115.483974, \"day\": 2, \"seq\": 1, \"placeId\": \"ChIJmR7koHpy0i0RhpGpybSUIAk\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"durationText\\\":\\\"約 14 分\\\",\\\"label\\\":\\\"\\\",\\\"seconds\\\":846,\\\"distanceM\\\":3923},\\\"stayMin\\\":45}\"}, {\"name\": \"Toyapakeh Dive Site\", \"lat\": -8.681988, \"lng\": 115.4832558, \"day\": 2, \"seq\": 2, \"placeId\": \"ChIJI5flhdNz0i0RXEqvGnUTDaM\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"manualDistanceKm\\\":null,\\\"manualDurationMin\\\":null,\\\"cruiseKmh\\\":null,\\\"bufferMin\\\":null,\\\"departAt\\\":null,\\\"notes\\\":null,\\\"seconds\\\":0,\\\"distanceM\\\":0,\\\"durationText\\\":\\\"約 1 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"The Wall (snorkeling place)\", \"lat\": -8.684567499999998, \"lng\": 115.4803087, \"day\": 1, \"seq\": 1, \"placeId\": \"ChIJLbcJeTlz0i0RoqlQggSVWr0\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"durationText\\\":\\\"約 13 分\\\",\\\"label\\\":\\\"\\\"},\\\"stayMin\\\":45}\"}, {\"name\": \"Maruti Group Office Nusa Penida\", \"lat\": -8.6797963, \"lng\": 115.4879285, \"day\": 1, \"seq\": 2, \"placeId\": \"ChIJ50_FC2Vy0i0RIaeNBrO52Gk\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"durationText\\\":\\\"約 13 分\\\",\\\"label\\\":\\\"\\\",\\\"seconds\\\":794,\\\"distanceM\\\":3946},\\\"stayMin\\\":45}\"}], \"days\": [{\"day\": 1, \"title\": \"Day 1\", \"items\": [\"The Wall (snorkeling place)\", \"Maruti Group Office Nusa Penida\"]}, {\"day\": 2, \"title\": \"Day 2\", \"items\": [\"Mega Pontoon Quick Silver\", \"Toyapakeh Dive Site\"]}], \"meta\": {}}', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-28 15:45:23', '2025-11-13 14:05:57'),
(11, 3, 'f3c8fc1b-94db-481c-b97d-f2b0d58d3c78', 'Test Save 02', '{\"title\": \"Test Save 02\", \"notes\": null, \"stops\": [{\"name\": \"Tegallalang Rice Terrace\", \"lat\": -8.43165, \"lng\": 115.279301, \"day\": 1, \"seq\": 1, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://picsum.photos/seed/gmtrip/640/400\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"durationText\\\":\\\"約 57 分\\\",\\\"label\\\":\\\"\\\"},\\\"stayMin\\\":45}\"}, {\"name\": \"Tukad Cepung Waterfall\", \"lat\": -8.440869, \"lng\": 115.38734, \"day\": 1, \"seq\": 2, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://picsum.photos/seed/gmtrip/640/400\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"durationText\\\":\\\"約 52 分\\\",\\\"label\\\":\\\"\\\"},\\\"stayMin\\\":45}\"}, {\"name\": \"Mount Batur Viewpoint\", \"lat\": -8.251479, \"lng\": 115.38124, \"day\": 1, \"seq\": 3, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://picsum.photos/seed/gmtrip/640/400\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"durationText\\\":\\\"約 3 分\\\",\\\"label\\\":\\\"\\\"},\\\"stayMin\\\":45}\"}, {\"name\": \"4 WD Jeep Sunrise Point\", \"lat\": -8.2488257, \"lng\": 115.3694175, \"day\": 1, \"seq\": 4, \"placeId\": \"ChIJJZcRSQD10S0Rh4bx-6IZR28\", \"meta_json\": \"{\\\"rating\\\":5,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://picsum.photos/seed/gmtrip/640/400\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":null,\\\"manualDistanceKm\\\":null,\\\"manualDurationMin\\\":null,\\\"cruiseKmh\\\":null,\\\"bufferMin\\\":null,\\\"departAt\\\":null,\\\"notes\\\":null},\\\"stayMin\\\":60}\"}], \"days\": [], \"meta\": {}}', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-29 02:05:40', '2025-10-29 02:05:40'),
(12, 3, 'f3c8fc1b-94db-481c-b97d-f2b0d58d3c78', 'Bali Bliss Adventure', '{\"title\": \"Bali Bliss Adventure\", \"notes\": {\"country\": \"Indonesia\", \"region\": \"Bali\", \"note\": \"A mix of relaxation and adventure in beautiful Bali.\"}, \"stops\": [], \"days\": [{\"day\": 1, \"items\": [\"Check into resort\", \"Relax at the beach\"], \"title\": \"Arrival in Bali\"}, {\"day\": 2, \"items\": [\"Visit rice terraces\", \"Explore Ubud market\"], \"title\": \"Ubud Exploration\"}, {\"day\": 3, \"items\": [\"Visit temples\", \"Attend a traditional dance performance\"], \"title\": \"Cultural Day\"}, {\"day\": 4, \"items\": [\"Snorkeling at Nusa Penida\", \"Beach time\"], \"title\": \"Water Activities\"}, {\"day\": 5, \"items\": [\"Last-minute shopping\", \"Transfer to airport\"], \"title\": \"Departure\"}], \"meta\": {}}', NULL, NULL, NULL, NULL, NULL, NULL, '2025-10-29 05:58:48', '2025-10-29 05:58:48'),
(13, 3, 'f3c8cf1b-94db-481c-b97d-f2b0d58d3c78', 'Test Save 1', '{\"title\": \"Test Save 1\", \"notes\": null, \"stops\": [{\"name\": \"Klong Plu Waterfall\", \"lat\": 12.064743, \"lng\": 102.312784, \"day\": 1, \"seq\": 1, \"placeId\": \"ChIJuzWDMHsRBDERhyITN2TwRu4\", \"meta_json\": \"{\\\"rating\\\":4.4,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU5NvejxhK7FhFLxLYKzsTJFuelVGtC8uQQtexQ8WLF0xrBG-nD5uKZXbQZL32K9hHWZMbOT2GNyovlimQEP9-_jN-1CEUP9wD7gDX3_oY_Qc_tXTvEg23hVuHtKF_S1ghYWuWAqmpKLR2D_Upl6RHLiah2C2KpGWSWOliy74OlgJX_nRuoaiptr6JNcBWelQA06uduzlr26J2U0I8FuKIPA5FCfO-jVaUOqxH5j-Wh06IufKeKAlYO2NAv7qN9xtUGaK6KCLMGrHktskMTy8CrywmdCrPMdpmaRQ-UeRUJm1jj_XtEPeoYUmvDkLWCG6iriMC6_KEmVyG2AJkaw_ogZSKm2rLIl1eeHd1Fr8rU0rnLAb2ROqNLC4ONesURVkE7SH2G9iTxS58UvIdeU5mu5SAVcQ5lSwzIv5QU36OC9oa_nz5BP41AuJLmH4-LhIsXKwI4yxZ8z8WQkI8EK6ap6HlP3dyMEMm4acSmZM8loZ1p0IUJcIzorMkuJkI5nLi7HeCKTWVjkctR9bz9GOqpn0CG0NbqiFdb-hPyp2s-dXexMHf8MIQNgDGgyt6koW-TQa-FfLB1CPCLSY8PUZ0iyxoo&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap.html&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=66704\\\",\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Bang Bao Pier\", \"lat\": 11.969174, \"lng\": 102.314618, \"day\": 1, \"seq\": 2, \"placeId\": \"ChIJaU-XdXAaBDER-T037O8-Tlw\", \"meta_json\": \"{\\\"rating\\\":4.2,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU7AybOR4LP6UqjPgEQif5jnmTO2Rnt-Bzer2ZE76k8a1tJHkGbP43wrDgAKz3ezf4fJUoBwdsKqpcMsQAHWBXMDinRxkC9ph22Rh_EK8ggWHQKnbwdsN4ChYXABCIn_ntEmmJyAjX6uupOD6a6bO1BoPBVG7VSQZyAR1zyQw2YnvshWrDA8pH9ZbT-pzwDt76CWzUHSosCHVexBTSYyvTvSiBBOluwn0SzaT1PN1nXS_1mmJVjXInR3b4R-MLdkncEx8vKE3X1w8cu0TT0Ilqx83PFiDT8UlNjqyq5FMEMI0CJmlSZUKj4UdheF6gQ8qtTn7jJMnGLCtdABPuxNQi039UFFYc_70jET8_yu9kBJternFDItenY_XvKs5fSkiFVNU96H3es6QHJf2m0gCYA3H_ym0NvY7-5Y41x29vkk19oc1L4c5CX6yDbInpA_TzHoUGatNN5tx-LosxAmYtDwDPboH0hOyYhcXnOk86HZo9qsUdXeo1edwYdJor-5vjpDJFfEJAaacsg1bBPL6gWbBa1DbzDcdd-c6l-X9VELavsf57ovLtA_F78dFYpU4kIoO5Bc&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap.html&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=88739\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":1,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}, {\"name\": \"Alarm Cafe Koh Chang\", \"lat\": 12.0644467, \"lng\": 102.2863136, \"day\": 1, \"seq\": 3, \"placeId\": \"ChIJB4WpB6MRBDERA0mWKRDiGlc\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":2,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}, {\"name\": \"Snorkel at Koh Rang\", \"lat\": 11.798276, \"lng\": 102.391414, \"day\": 1, \"seq\": 4, \"placeId\": \"ChIJMafNI2QgBDERd5nA8rdoBtI\", \"meta_json\": \"{\\\"rating\\\":4.8,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU5bhppW7La4rK7MV0XztU8D-dR5M5ZeEyelk57W4QJsaZO9YoW8LE4MTdsi3i9OwzX_TMQHyO-ge80pIS_V3cF_xHuIZX0qZZ_4KjTya7hU1235TgIOgJrb3-fqp7RQwfEcn7CTrd2dtL5nk3zQzrt9OmISWN25SjN29NIKFIu8RwyurcFtQf5ACnXWQu68n9VlIDTnKqb7TX6YCQaG915UgS4s4c62lrSqRa5eFdh9V0C1JPVMAmXL_ZNGzHZ80557zSw0diWtFs_iqI9D80GX8Tz9dmLd8ouK4yZ93VVbZTDKCdu-ENFU1_HNQtcB6fc61UqmiHT1XeYxrdVbfc7CZWI1-UU7xwKy3OClu8BJS1ajbqTQeXvRn3-uPCgAa5B98BursYxC6OzrB0gOWDja1F8PddG2FsSa7e15eeAwMlGo4C4Yexii9pPRru9S0WXmlY-fdfKEQSfK_KzUx_GePrN4vA1Q-kl3GNB87OxpYm_zdjunrAIXViTTwsWpGavu9QYZ8rzwvWv5CXfSR9m2syn8wUc9uIyLUW4hRY1g-702NNlzf-Exe2jIrhHb3GW72gfF&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap.html&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=55167\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":3,\\\"mode\\\":\\\"MANUAL\\\",\\\"manualDistanceKm\\\":31.7,\\\"manualDurationMin\\\":42,\\\"cruiseKmh\\\":60,\\\"bufferMin\\\":10,\\\"label\\\":\\\"fallback:manual\\\",\\\"durationText\\\":\\\"約 42 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Klong Prao beach\", \"lat\": 12.0595928, \"lng\": 102.2884585, \"day\": 2, \"seq\": 1, \"placeId\": \"ChIJsXLfCpARBDERe9ngfNuzX7s\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU4kcADObu_SF4l5ZN_xHMss2u3-zgL_O4oxopQuHhHW3Hp6i1JIMcTUXgJJZY616cfGr3KaDTZT9I6KzIa7PIJu-QxiBUmoPDQds7w_gWIiRzjn2f-gDr1rtDkG3q4QzqJEHjPJ_gPZUP0PO-Qqr9LQjOZgwZjAMiSPpldrBwblekZbVrKulyM5My09E9J_lrjtav85_l7Xb5UeO3J0ycMjQw2kw1xiqmUddN2SV8mJdJpNGHpCumzUMq5pXjoHehZSS-WUW6s-9hM-XUzYZ9cQ0FfGDKJP0Ak2becRCEkz3Rsb1T7VgtjBrIsKesGJfqXNTQdRpqoH-ynsoKXIN8Ve5a_t-X7ByssOg4d_QiexePgsMFWVx49M82wea9Q9l0grRiIUE4pOL60MC1ye1EBAmWPkoxg0Ojm-rNsCVD9FM1-PO2pyci41K2XMED9NKBCGb6LOhIZsFIWEga0gzUZXd3UdeEM4UDyYLbUYEP0dmrpGjyYL5fzhZkFm69c16HIchRvY85sB0sIR4h8O_AvftGmCJXBxrRuh6x-dXsem2URVuVnGXQT5udO2RJ_z6mhhK4Ax&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap.html&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=58959\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":4,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}, {\"name\": \"หาดไชยเชษฐ์\", \"lat\": 12.066865, \"lng\": 102.2804412, \"day\": 2, \"seq\": 2, \"placeId\": \"ChIJ9-qbkvoRBDERLZd-aL6mtEs\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":5,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}, {\"name\": \"Khlong Nonsi Waterfall\", \"lat\": 12.1014084, \"lng\": 102.3441897, \"day\": 3, \"seq\": 1, \"placeId\": \"ChIJ-y1A9ewTBDERb_-lwrCkUhg\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":6,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}, {\"name\": \"St.Sergius of Radonezh Orthodox Church\", \"lat\": 12.1298723, \"lng\": 102.2801305, \"day\": 3, \"seq\": 2, \"placeId\": \"ChIJU8vGDO0SBDERPY3H28VAhTg\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":7,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}, {\"name\": \"象島國家公園\", \"lat\": 12.124744, \"lng\": 102.2692555, \"day\": 3, \"seq\": 3, \"placeId\": \"ChIJf9d2GnIRBDERoq03lJjSEQk\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"index\\\":8,\\\"mode\\\":null},\\\"stayMin\\\":60}\"}], \"days\": [{\"day\": 1, \"title\": \"Day 1\", \"items\": [\"Klong Plu Waterfall\", \"Bang Bao Pier\", \"Alarm Cafe Koh Chang\", \"Snorkel at Koh Rang\"]}, {\"day\": 2, \"title\": \"Day 2\", \"items\": [\"Klong Prao beach\", \"หาดไชยเชษฐ์\"]}, {\"day\": 3, \"title\": \"Day 3\", \"items\": [\"Khlong Nonsi Waterfall\", \"St.Sergius of Radonezh Orthodox Church\", \"象島國家公園\"]}], \"meta\": {}}', NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-11 07:59:06', '2025-11-24 09:45:57'),
(14, 1, 'f9a69252-eda1-4d84-b345-93e0c977ab73', 'trip to bali', '{\"title\": \"trip to bali\", \"notes\": null, \"stops\": [{\"name\": \"Mount Batur Viewpoint\", \"lat\": -8.251479, \"lng\": 115.38124, \"day\": 1, \"seq\": 2, \"placeId\": \"ChIJOSQNXNk90i0Ry14lbc1j8yA\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU6dx82jZiG8zMacHLe6EsEOKGc4l_dPEmOF2dcnd9urY8tEDcNE00VnJrkf8AmlVQU18mkrhzARuXNw_-ln6alctO7OcScDIjpMqFptj5wxpBNIW6Fnq42VAnTF-hE43NrawWPY622HEqCHiY0wZUagi1PgEoXkdq5iqocToJccxA864ImJMUEVU8-HxG8PEYrP5Jo5_pVqQm6c2_JJ7BjY1lsMYSfGNRoGwG1CLmk7ncYiw8QrcID9vq9Lpuigxwy6e-qP5KSmwpaPBTUXoC2r4pTWoZaXUyxL-ORvJq8tl0OWs30&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=48687\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":3114,\\\"distanceM\\\":27306,\\\"durationText\\\":\\\"約 52 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Pemulan Bali Farm Cooking School, Ubud\", \"lat\": -8.3580667, \"lng\": 115.3004526, \"day\": 1, \"seq\": 3, \"placeId\": \"ChIJq6N3zHcf0i0RYHZzviq1TaY\", \"meta_json\": \"{\\\"rating\\\":5,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU64Yubenm7xJ8sCj0cDxgObTbqtdNiEhw6bhBV2AU3CIqLfIfyo_qZAWhy3cMZefQwbBUaM7n6F8Gq3v1GOPWL58MzmJ1GR6Dh_hGxJYZ1Xt8MkH8zW_dQWgGXaqIWeIhicJuHXn8K81bJmZddu33p9AhxB4K6k5eRoCSjIvrJRwKEh6MBV7PkWZsMVaiL_f8MeZwel5tjS1qo5s6anjxIRJl4PrQAVaeYDCnQ1ijDywW7yNJyrHFiQLgmABbmF0xSLU1HJ0jaU3Yml-vtOWrTYsjpR0xYJqpmfCiVSLT3fKZuPlkI&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=17020\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":2662,\\\"distanceM\\\":22545,\\\"durationText\\\":\\\"約 44 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Tegallalang Rice Terrace\", \"lat\": -8.43165, \"lng\": 115.279301, \"day\": 2, \"seq\": 1, \"placeId\": \"ChIJ4wD5Iwsi0i0R7QRsOGmJGo0\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Tukad Cepung Waterfall\", \"lat\": -8.440869, \"lng\": 115.38734, \"day\": 2, \"seq\": 2, \"placeId\": \"ChIJQ6ocSKAb0i0RP1CIrkak0ws\", \"meta_json\": \"{\\\"rating\\\":4.6,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAWn5SU4ZZWE4JR00_hSSpp9ucPNKYAoeTGKIhEUvgrEgoDAOGpngdSnCNqZXwTP02QtQ8vZ7wD1ZdAokLvvgQMQGblKAVc-yEM6Mhui2eLi_4EjpiJUswAkLmDhKGnYkiixYsClhJnJQmXHWjFSwowxiRfee6yxW7jn_d4cjcxeWYqSLQrWGS-rblkT6ksJHlJArJeo1RRDscAWiMXg2GXF6HC2zlJz4-UeB-xOlyDnDrfNNw7mW23mJGW8xt9q3BJLrM71C1hIxZhnN8qzKlP-LW8IK1xrW7cPJvIiRbw7pVJq84GKW-VTf6ODXxiklOdF9OoESxpFBnrjur0QWbGH6PgkXLdyLHucane1WFrww5crUEKVEI52fX5yXj6br-qy5IaKPG6aDfhRjFjtnJWzll62GDhfqddFQ7tzvf7-evS3JX9kLwvPymOjMeSJZbq3RZWkt6ipoyVFNU5y_jmvjNu5CN4qCd3hIuNC0sYdHTiN2IhDkydjtLaaL8kooRabtxvjQyrubxJDlByyWC67VwjGnB5a3Hqzz6dH_caRUjOm6mIqyzKz_JOM7t9CS23A2nzT07Vsp&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=126312\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":3411,\\\"distanceM\\\":27473,\\\"durationText\\\":\\\"約 57 分\\\"},\\\"stayMin\\\":60}\"}], \"days\": [{\"day\": 1, \"title\": \"Day 1\", \"items\": [\"Mount Batur Viewpoint\", \"Pemulan Bali Farm Cooking School, Ubud\"]}, {\"day\": 2, \"title\": \"Day 2\", \"items\": [\"Tegallalang Rice Terrace\", \"Tukad Cepung Waterfall\"]}], \"meta\": {}}', 4, 'I really enjoy this trip, will come back soon!', '/static/uploads/DSCF5966.JPG', 'Indonesia', 'Bali', NULL, '2025-11-13 14:22:33', '2025-11-17 06:24:30'),
(15, 1, '705c58b3-4408-4636-b262-e3ed6708ee9d', 'My Trip', '{\"title\": \"My Trip\", \"notes\": null, \"stops\": [{\"name\": \"Tegenungan Waterfall\", \"lat\": 0, \"lng\": 0, \"day\": 1, \"seq\": 1, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Gitgit Waterfall\", \"lat\": 0, \"lng\": 0, \"day\": 1, \"seq\": 2, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Sekumpul Waterfall\", \"lat\": -8.2386, \"lng\": 115.1686, \"day\": 1, \"seq\": 3, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Nungnung Waterfall\", \"lat\": -8.3918, \"lng\": 115.2367, \"day\": 1, \"seq\": 4, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Tukad Cepung Waterfall\", \"lat\": -8.440869, \"lng\": 115.38734, \"day\": 1, \"seq\": 5, \"placeId\": null, \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}], \"days\": [{\"day\": 1, \"title\": \"Day 1\", \"items\": [\"Tegenungan Waterfall\", \"Gitgit Waterfall\", \"Sekumpul Waterfall\", \"Nungnung Waterfall\", \"Tukad Cepung Waterfall\"]}], \"meta\": {}}', NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-17 01:53:45', '2025-11-17 01:53:45'),
(16, 3, 'f3c8cf1b-94db-481c-b97d-f2b0d58d3c78', 'Test chatbot Trip 1', '{\"title\": \"Test chatbot Trip 1\", \"notes\": \"測試chatbot行程顯示\", \"stops\": [{\"name\": \"Cikaso Waterfall\", \"lat\": -7.360475, \"lng\": 106.617578, \"day\": 1, \"seq\": 1, \"placeId\": \"ChIJZ-viR-0DaC4RbS3rUaKtvFE\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Curug Cimahi\", \"lat\": -6.898519, \"lng\": 107.518947, \"day\": 1, \"seq\": 2, \"placeId\": \"TP-154-D1-S2-226\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":20787,\\\"distanceM\\\":176605,\\\"durationText\\\":\\\"約 346 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Tumpak Sewa Waterfall\", \"lat\": -7.090911, \"lng\": 107.668887, \"day\": 1, \"seq\": 3, \"placeId\": \"ChIJQdppWAgU1i0Rgil3Bl_MlEo\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":4739,\\\"distanceM\\\":39765,\\\"durationText\\\":\\\"約 79 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Nangka Waterfall\", \"lat\": -6.669066, \"lng\": 106.726408, \"day\": 1, \"seq\": 4, \"placeId\": \"ChIJUzxTq9XPaS4RKRG_pEF2QvY\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":14580,\\\"distanceM\\\":207614,\\\"durationText\\\":\\\"約 243 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Cibeureum Waterfall\", \"lat\": -6.749822, \"lng\": 107.000799, \"day\": 1, \"seq\": 5, \"placeId\": \"ChIJAQAAAIS0aS4R2KV_XwlwzqI\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":7976,\\\"distanceM\\\":63305,\\\"durationText\\\":\\\"約 133 分\\\"},\\\"stayMin\\\":60}\"}], \"days\": [{\"day\": 1, \"title\": \"Day 1\", \"items\": [\"Cikaso Waterfall\", \"Curug Cimahi\", \"Tumpak Sewa Waterfall\", \"Nangka Waterfall\", \"Cibeureum Waterfall\"]}], \"meta\": {}}', NULL, NULL, NULL, NULL, NULL, NULL, '2025-11-24 03:30:02', '2025-11-24 03:30:02'),
(17, 1, '277a61ae-576d-4f60-aa59-34cdbb589021', 'NTT', '{\"title\": \"NTT\", \"notes\": null, \"stops\": [{\"name\": \"Kelimutu Lakes\", \"lat\": -8.748933, \"lng\": 121.85153, \"day\": 1, \"seq\": 1, \"placeId\": \"ChIJ_QA3rctCrS0R7QfWMyD0NNE\", \"meta_json\": \"{\\\"rating\\\":null,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":null,\\\"stayMin\\\":60}\"}, {\"name\": \"Manulalu Bed and Breakfast\", \"lat\": -8.863217299999999, \"lng\": 120.9944403, \"day\": 2, \"seq\": 1, \"placeId\": \"ChIJN5vfGyzcsi0RYLGCEckGmjQ\", \"meta_json\": \"{\\\"rating\\\":4.3,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":390,\\\"distanceM\\\":3075,\\\"durationText\\\":\\\"約 7 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Bajawa Hot Springs\", \"lat\": -8.785831, \"lng\": 120.975606, \"day\": 2, \"seq\": 2, \"placeId\": \"ChIJdw1CmRrcsi0RKW7K26n99Kg\", \"meta_json\": \"{\\\"rating\\\":4.6,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAZLasHod3Bac46zadHQR-sSZ3PUnMkBQVDX6b23UjK3_Bd-O9lDhKICTfQfxFP2hHx0WijoCQLnaoZZQOvnMmJ-znrEUtz9tQlKYNUTSzSTrBCeTkP_eN7xvjXo2jHWbOY1LcLPfwjYuruQWE0Ulubun9ZzrS8lkRawROHCj4cUIXXDE_BkjLKib9NR1F6RVnvnCK-gr-39TnRzzModIFFRBeDdvjI6FLflMvXt0ewSjN31UW1MgiIXVxY2LYhABzrsxUNmxx4yhvtAktTwAAcARl8mKyYpv9KYg6Eh_H9mOzKh8MTn868dJCb9yoANev9JqG3EbKwuODLgZ_SZOUQsBQUDS7zAXZUFRJ0tVtIHv8WSjIc7ULQP9vt1oTfx5lUBTMMbvRDTZrusAWWE2vlA7sD_GW5bkYd_Rn38Z04YfoM4&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=31854\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":1934,\\\"distanceM\\\":17399,\\\"durationText\\\":\\\"約 32 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Bena Village\", \"lat\": -8.876744, \"lng\": 120.985898, \"day\": 2, \"seq\": 3, \"placeId\": \"ChIJFS0TtJ_esi0RbpzhZhF9kjc\", \"meta_json\": \"{\\\"rating\\\":4.6,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAZLasHr4t5mv0kSrGN54idPlSc4CbSrefHA6VoDOZh45YTgaO_Qd87V_e6HP4poNZKzM-KQpZ1PcXdQ5UU9Mrb--Usi-l7xPPIDR8e8t-lHbt_pkKy107wK-dbz2DZbZhJbetRXl2vdUTgXmsWWDoi2_PgPZYfg_PSOv98HTJZkaVpSzPlE8MTb23iCn_TJ6knTrcWAUvGI54k70AkXqEtnhV-QbwmR0KScf_eurOS_6pSSK0MIN0qHfNH44u424HjY80wETdMeH0iV_8n3I_GTXJ9HyMRdO_-xWa83pi1IazRH_-bpjEwJYfCMdIabsaeVMUTUtrhgiKhnhHirhB0erj63c12ZFtehiFa_M9Fc6ezb-ZBhu-5-lJ5Z0kn_F12XFYM9MqI1PQ5SrEL0TWeBSUNCbJDq1iPdE-1GmoiOzK5jvwcMK&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=37436\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":1736,\\\"distanceM\\\":15079,\\\"durationText\\\":\\\"約 29 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Kelimutu Crater Lakes Ecolodge\", \"lat\": -8.7516118, \"lng\": 121.8584923, \"day\": 1, \"seq\": 2, \"placeId\": \"ChIJgyoO5eBfrS0RR4OPYlKVmN0\", \"meta_json\": \"{\\\"rating\\\":4.3,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":88,\\\"distanceM\\\":1065,\\\"durationText\\\":\\\"約 1 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Santiago Cafe & Resto\", \"lat\": -8.7505895, \"lng\": 121.8458082, \"day\": 1, \"seq\": 3, \"placeId\": \"ChIJd8uJyJVCrS0RNTdxdfL_bx8\", \"meta_json\": \"{\\\"rating\\\":4.5,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":\\\"https://maps.googleapis.com/maps/api/place/js/PhotoService.GetPhoto?1sAZLasHrhq9rUhaDxvVRfKJtBu9qzkTMBEyGy48SD8p_stx4QnTmA0TAvH1E2D7zfglSS7h0ndjuwIDy9DlOANt4iPO09DFr9U1wain2PrkJpEtP0s3hyWn08vNL65P9MtDB2GiK2V5RrgTzNLhzw92dPkiZGJnOWAEcDE9Zdx42QQbWmUkU9_dJdlTCtnxh_N9HkQxtlUiEyNhMDcCKTNG_Sh201SnE1u2nKvRf1o9-OO2QKzG0RQE73z-JKnqQsBTzY3asVlNTvOVRD8qm3afmtalIgArnsWQ7Uv3cjFpFzEfJm9L3Mfcdew7bVLCG4NjsyMMxFQI-tfnjJT97pX4ohOYMBdld9603vxmrrWLi0yab-Q9b5CFU3p3UBekrsUttzdj5C-0DIZHlmd-FMN-AeTntpTM3DJ3cUVXorInk749Vn7A&3u720&4u480&5m1&2e1&callback=none&r_url=http%3A%2F%2F127.0.0.1%3A5000%2Fmap&key=AIzaSyCUZ1VEQNPJkrDZ4mbRvwcJZJv0VQwjD30&token=35666\\\",\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":172,\\\"distanceM\\\":1899,\\\"durationText\\\":\\\"約 3 分\\\"},\\\"stayMin\\\":60}\"}, {\"name\": \"Tea Box Nusa Tenggara\", \"lat\": -8.8041784, \"lng\": 120.9686391, \"day\": 2, \"seq\": 4, \"placeId\": \"ChIJKc6gFL_gsi0R7gyYIb11edA\", \"meta_json\": \"{\\\"rating\\\":4,\\\"userRatingsTotal\\\":null,\\\"photoUrl\\\":null,\\\"badges\\\":[],\\\"leg\\\":{\\\"mode\\\":\\\"DRIVING\\\",\\\"seconds\\\":1377,\\\"distanceM\\\":12329,\\\"durationText\\\":\\\"約 23 分\\\"},\\\"stayMin\\\":60}\"}], \"days\": [{\"day\": 1, \"title\": \"Day 1\", \"items\": [\"Kelimutu Lakes\", \"Kelimutu Crater Lakes Ecolodge\", \"Santiago Cafe & Resto\"]}, {\"day\": 2, \"title\": \"Day 2\", \"items\": [\"Manulalu Bed and Breakfast\", \"Bajawa Hot Springs\", \"Bena Village\", \"Tea Box Nusa Tenggara\"]}], \"meta\": {}}', 4, 'good trip', '/static/uploads/DSCF5861.JPG', 'Indonesia', 'Nusa Tenggara', NULL, '2025-12-07 05:40:37', '2025-12-07 05:41:55');

-- --------------------------------------------------------

--
-- Table structure for table `user_trip_points`
--

CREATE TABLE `user_trip_points` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_trip_id` int(10) UNSIGNED NOT NULL,
  `seq` int(10) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `lat` double NOT NULL DEFAULT 0,
  `lng` double NOT NULL DEFAULT 0,
  `place_id` varchar(128) DEFAULT NULL,
  `meta_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `points`
--
ALTER TABLE `points`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_points_place_id` (`place_id`),
  ADD KEY `idx_coords` (`lat`,`lng`),
  ADD KEY `idx_points_name` (`name`);

--
-- Indexes for table `poi_candidates`
--
ALTER TABLE `poi_candidates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_scope` (`country`,`region`,`name`),
  ADD KEY `idx_matched` (`matched_point_id`);

--
-- Indexes for table `trips`
--
ALTER TABLE `trips`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_trips_country_region` (`country`,`region`),
  ADD KEY `idx_trips_source_status` (`source`,`curation_status`);

--
-- Indexes for table `trip_points`
--
ALTER TABLE `trip_points`
  ADD PRIMARY KEY (`trip_id`,`day`,`seq`),
  ADD UNIQUE KEY `uq_trip_point_once` (`trip_id`,`day`,`point_id`),
  ADD KEY `idx_tp_point` (`point_id`),
  ADD KEY `idx_tp_trip_day` (`trip_id`,`day`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `uq_users_username` (`username`),
  ADD UNIQUE KEY `uq_users_email` (`email`);

--
-- Indexes for table `user_trips`
--
ALTER TABLE `user_trips`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_title` (`user_id`,`title`),
  ADD KEY `idx_user_trips_userid_created` (`user_id`,`created_at`);

--
-- Indexes for table `user_trip_points`
--
ALTER TABLE `user_trip_points`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_points_trip_seq` (`user_trip_id`,`seq`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `points`
--
ALTER TABLE `points`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=232;

--
-- AUTO_INCREMENT for table `poi_candidates`
--
ALTER TABLE `poi_candidates`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `trips`
--
ALTER TABLE `trips`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=156;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `user_trips`
--
ALTER TABLE `user_trips`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `user_trip_points`
--
ALTER TABLE `user_trip_points`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `trip_points`
--
ALTER TABLE `trip_points`
  ADD CONSTRAINT `fk_tp_point` FOREIGN KEY (`point_id`) REFERENCES `points` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tp_trip` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_trip_points`
--
ALTER TABLE `user_trip_points`
  ADD CONSTRAINT `fk_user_trip_points_trip` FOREIGN KEY (`user_trip_id`) REFERENCES `user_trips` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
