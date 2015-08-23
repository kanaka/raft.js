(ns avg
  (:require [clojure.string :as string]))

(def d (slurp "/data2/joelm/personal/programming/html5/raft.js/research_class/data/data_kill_leader_100.dat"))
(def data (map #(string/split %1 #" ") (drop 1 (string/split d #"\n"))))
(def avgs (for [[n nts] (group-by first (for [[n t] data] [(read-string n) (read-string t)]))] [n (/ (apply + (map second nts)) (count nts))]))

(doseq [[n a] avgs]
  (println n a))
